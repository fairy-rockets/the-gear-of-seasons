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

async function probeExif(tags: [number, string][]): Promise<media.ProbeResult> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'the-gear-of-seasons-probe-spec-'));
  try {
    const plain = path.join(dir, 'plain.jpg');
    await promisify(execFile)('magick', ['-size', '16x16', 'xc:red', plain]);
    const jpeg = await fs.readFile(plain);
    const filepath = path.join(dir, 'exif.jpg');
    // SOI の直後に APP1 を差し込む。
    await fs.writeFile(filepath, Buffer.concat([jpeg.subarray(0, 2), exifSegment(tags), jpeg.subarray(2)]));
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

});
