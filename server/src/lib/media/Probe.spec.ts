import { describe, it } from 'mocha';
import assert from 'assert';
import * as fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as media from './Probe.js';
import Asset from '../Asset.js';

// DateTimeOriginal だけを持つ EXIF の APP1 セグメント（リトルエンディアンの TIFF）。
function exifSegment(dateTimeOriginal: string): Buffer {
  const tiff = Buffer.alloc(64);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  // IFD0: Exif IFD へのポインタだけ。
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x8769, 10);
  tiff.writeUInt16LE(4, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18);
  tiff.writeUInt32LE(0, 22);
  // Exif IFD: DateTimeOriginal だけ。
  tiff.writeUInt16LE(1, 26);
  tiff.writeUInt16LE(0x9003, 28);
  tiff.writeUInt16LE(2, 30);
  tiff.writeUInt32LE(20, 32);
  tiff.writeUInt32LE(44, 36);
  tiff.writeUInt32LE(0, 40);
  tiff.write(`${dateTimeOriginal}\0`, 44, 'latin1');
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const header = Buffer.from([0xff, 0xe1, 0, 0]);
  header.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([header, body]);
}

describe("Media", () => {
  it("parse jpeg", async () => {
    const filepath = new Asset().pathOf('static/omote/kaede.jpg');
    const r = await media.probe(filepath);
    assert.equal(r.width, 1000);
    assert.equal(r.height, 1000);
  });

  it("EXIF の撮影日時を timestamp にする", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'the-gear-of-seasons-probe-spec-'));
    try {
      const plain = path.join(dir, 'plain.jpg');
      await promisify(execFile)('magick', ['-size', '16x16', 'xc:red', plain]);
      const jpeg = await fs.readFile(plain);
      const filepath = path.join(dir, 'exif.jpg');
      // SOI の直後に APP1 を差し込む。
      await fs.writeFile(filepath, Buffer.concat([jpeg.subarray(0, 2), exifSegment('2016:05:13 23:14:52'), jpeg.subarray(2)]));
      const r = await media.probe(filepath);
      assert.equal(r.width, 16);
      assert.equal(r.timestamp?.format('YYYY-MM-DD HH:mm:ss'), '2016-05-13 23:14:52');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
