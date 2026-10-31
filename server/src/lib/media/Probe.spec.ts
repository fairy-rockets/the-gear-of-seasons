import { describe, it } from 'mocha';
import assert from 'assert';
import * as fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as media from './Probe.js';
import Asset from '../Asset.js';

// EXIF の APP1 セグメント（リトルエンディアンの TIFF）。
function exifSegment(tags: [number, string][]): Buffer {
  const dataOffset = 26 + 2 + tags.length * 12 + 4;
  const values = tags.map(([, value]) => Buffer.from(`${value}\0`, 'latin1'));
  const tiff = Buffer.alloc(dataOffset + values.reduce((size, value) => size + value.length, 0));
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  // IFD0: Exif IFD へのポインタだけ。
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x8769, 10);
  tiff.writeUInt16LE(4, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18);
  tiff.writeUInt16LE(tags.length, 26);
  let offset = dataOffset;
  tags.forEach(([tag], i) => {
    const entry = 28 + i * 12;
    tiff.writeUInt16LE(tag, entry);
    tiff.writeUInt16LE(2, entry + 2);
    tiff.writeUInt32LE(values[i].length, entry + 4);
    if (values[i].length <= 4) {
      values[i].copy(tiff, entry + 8);
    } else {
      tiff.writeUInt32LE(offset, entry + 8);
      values[i].copy(tiff, offset);
      offset += values[i].length;
    }
  });
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const header = Buffer.from([0xff, 0xe1, 0, 0]);
  header.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([header, body]);
}

async function probeExif(tags: [number, string][], ext = 'jpg'): Promise<media.ProbeResult> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'the-gear-of-seasons-probe-spec-'));
  try {
    const plain = path.join(dir, 'plain.jpg');
    await promisify(execFile)('magick', ['-size', '16x16', 'xc:red', plain]);
    const jpeg = await fs.readFile(plain);
    const filepath = path.join(dir, 'exif.jpg');
    // SOI の直後に APP1 を差し込む。
    await fs.writeFile(filepath, Buffer.concat([jpeg.subarray(0, 2), exifSegment(tags), jpeg.subarray(2)]));
    if (ext !== 'jpg') {
      const converted = path.join(dir, `exif.${ext}`);
      await promisify(execFile)('magick', [filepath, converted]);
      return await media.probe(converted);
    }
    return await media.probe(filepath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function probeVideo(tags: Record<string, string>, streamOnly = false): Promise<media.ProbeResult> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'the-gear-of-seasons-video-spec-'));
  try {
    const filepath = path.join(dir, 'video.mp4');
    const metadata = Object.entries(tags).flatMap(([key, value]) => ['-metadata', `${key}=${value}`]);
    await promisify(execFile)('ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=16x16:d=0.1',
      '-c:v', 'libx264', '-movflags', 'use_metadata_tags', ...metadata, filepath,
    ]);
    if (streamOnly) {
      // ムービーヘッダーの日時だけをゼロにし、トラック/映像ストリームの日時を残す。
      const video = await fs.readFile(filepath);
      const mvhd = video.indexOf(Buffer.from('mvhd'));
      assert.ok(mvhd > 0);
      assert.equal(video[mvhd + 4], 0);
      video.writeUInt32BE(0, mvhd + 8);
      await fs.writeFile(filepath, video);
    }
    return await media.probe(filepath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe("Media", () => {
  it("parse jpeg", async () => {
    const filepath = new Asset().pathOf('static/omote/kaede.jpg');
    const r = await media.probe(filepath);
    assert.equal(r.width, 1000);
    assert.equal(r.height, 1000);
  });

  it("EXIF の撮影日時を timestamp にする", async () => {
    const r = await probeExif([[0x9003, '2016:05:13 23:14:52']]);
    assert.equal(r.width, 16);
    assert.equal(r.timestamp?.format('YYYY-MM-DD HH:mm:ss'), '2016-05-13 23:14:52');
    assert.equal(r.timestamp?.valueOf(), new Date(2016, 4, 13, 23, 14, 52).valueOf());
  });

  it("CreateDate だけでも撮影日時を読む", async () => {
    const r = await probeExif([[0x9004, '2020:02:03 04:05:06']]);
    assert.equal(r.timestamp?.valueOf(), new Date(2020, 1, 3, 4, 5, 6).valueOf());
  });

  it("CreateDate を DateTimeOriginal より優先する", async () => {
    const r = await probeExif([[0x9003, '2016:05:13 23:14:52'], [0x9004, '2020:02:03 04:05:06']]);
    assert.equal(r.timestamp?.valueOf(), new Date(2020, 1, 3, 4, 5, 6).valueOf());
  });

  it("EXIF のオフセットとサブ秒を使わずローカル時刻として読む", async () => {
    const r = await probeExif([
      [0x9003, '2016:05:13 23:14:52'], [0x9004, '2020:02:03 04:05:06'],
      [0x9011, '-05:00'], [0x9012, '+02:00'], [0x9291, '123'], [0x9292, '456'],
    ]);
    assert.equal(r.timestamp?.valueOf(), new Date(2020, 1, 3, 4, 5, 6).valueOf());
    assert.equal(r.timestamp?.millisecond(), 0);
  });

  it("スラッシュ区切りの撮影日時もローカル時刻として読む", async () => {
    const r = await probeExif([[0x9004, '2020/02/03 04:05:06']]);
    assert.equal(r.timestamp?.valueOf(), new Date(2020, 1, 3, 4, 5, 6).valueOf());
  });

  it("撮影日時が無い画像と読めない日時は無視する", async () => {
    for (const tags of [[], [[0x9003, 'invalid date']]] as [number, string][][]) {
      const r = await probeExif(tags);
      assert.equal(r.timestamp, undefined);
      assert.equal(r.width, 16);
    }
  });

  it("PNG のテキストに格納された EXIF プロファイルも読む", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'the-gear-of-seasons-png-spec-'));
    try {
      const filepath = path.join(dir, 'raw-exif.png');
      const exif = exifSegment([[0x9004, '2020:02:03 04:05:06']]).subarray(4);
      const rawProfile = `\nexif\n${exif.length.toString().padStart(8)}\n${exif.toString('hex')}\n`;
      await promisify(execFile)('magick', ['-size', '16x16', 'xc:red', '-set', 'Raw profile type exif', rawProfile, filepath]);
      const png = await fs.readFile(filepath);
      assert.ok(png.includes(Buffer.from('Raw profile type exif')));
      assert.ok(!png.includes(Buffer.from('eXIf')));
      const r = await media.probe(filepath);
      assert.equal(r.timestamp?.valueOf(), new Date(2020, 1, 3, 4, 5, 6).valueOf());
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("改行入りの EXIF が別の日時項目として読まれない", async () => {
    const r = await probeExif([[0x9004, 'invalid\n2020:02:03 04:05:06']]);
    assert.equal(r.timestamp, undefined);
    assert.equal(r.width, 16);
  });

  it("HEIC でも EXIF の撮影日時と優先順位を保つ", async function () {
    this.timeout(10000);
    const r = await probeExif([[0x9003, '2016:05:13 23:14:52'], [0x9004, '2020:02:03 04:05:06']], 'heic');
    assert.equal(r.mimeType, 'image/heic');
    assert.equal(r.width, 16);
    assert.equal(r.timestamp?.valueOf(), new Date(2020, 1, 3, 4, 5, 6).valueOf());
  });

  it("動画の creation_time は UTC の瞬間として読む", async () => {
    const r = await probeVideo({creation_time: '2020-02-03T04:05:06Z'});
    assert.equal(r.type, 'video');
    assert.equal(r.width, 16);
    assert.equal(r.timestamp?.valueOf(), Date.parse('2020-02-03T04:05:06Z'));
  });

  it("動画はオフセット付き撮影日時を creation_time より優先する", async () => {
    const r = await probeVideo({
      creation_time: '2020-02-03T04:05:06Z',
      'com.apple.quicktime.creationdate': '2019-05-06T07:08:09+09:00',
    });
    assert.equal(r.timestamp?.valueOf(), Date.parse('2019-05-06T07:08:09+09:00'));
  });

  it("動画のタイムゾーンがない撮影日時はローカル時刻として読む", async () => {
    const r = await probeVideo({date: '2020-02-03T04:05:06'});
    assert.equal(r.timestamp?.valueOf(), new Date(2020, 1, 3, 4, 5, 6).valueOf());
  });

  it("動画の不正な撮影日時は無視して有効な creation_time を読む", async () => {
    const r = await probeVideo({date: '2020-02-31T04:05:06Z', creation_time: '2020-02-03T04:05:06Z'});
    assert.equal(r.timestamp?.valueOf(), Date.parse('2020-02-03T04:05:06Z'));
  });

  it("動画は映像ストリームだけの creation_time も読む", async () => {
    const r = await probeVideo({creation_time: '2020-02-03T04:05:06Z'}, true);
    assert.equal(r.timestamp?.valueOf(), Date.parse('2020-02-03T04:05:06Z'));
  });

  it("動画の撮影日時が無い・不正・ゼロ日時なら未設定にする", async () => {
    for (const tags of [{}, {date: 'invalid'}, {date: '2020-02-03'}, {date: '2020-02-03T04:05:06+25:00'}, {date: '1904-01-01T00:00:00Z'}, {creation_time: '1970-01-01T00:00:00Z'}] as Record<string, string>[]) {
      const r = await probeVideo(tags);
      assert.equal(r.timestamp, undefined);
    }
  });

  it("音声の creation_time は撮影日時として使わない", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'the-gear-of-seasons-audio-spec-'));
    try {
      const filepath = path.join(dir, 'audio.m4a');
      await promisify(execFile)('ffmpeg', [
        '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=8000:cl=mono', '-t', '0.1',
        '-metadata', 'creation_time=2020-02-03T04:05:06Z', filepath,
      ]);
      const r = await media.probe(filepath);
      assert.equal(r.type, 'audio');
      assert.equal(r.timestamp, undefined);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

});
