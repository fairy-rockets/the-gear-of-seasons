import * as fs from 'fs/promises';
import path from 'path';
import os from 'os';

import ExifReader from 'exifreader';
import dayjs from 'dayjs';
import {fileTypeFromFile} from 'file-type';

import md5sum from '../md5sum.js';
import FormatError from './FormatError.js';
import avProbe from './AvProbe.js';
import imageProbe from './ImageProbe.js';

export type MediaType = 'image' | 'video' | 'audio';

export type ProbeResult = {
  readonly type: MediaType;
  readonly ext: string;
  readonly md5sum: string;
  readonly timestamp: dayjs.Dayjs | undefined;
  readonly mimeType: string;
  readonly width?: number;
  readonly height?: number;
  readonly duration?: number;
};

export async function probe(srcFilePath: string): Promise<ProbeResult> {
  const hash = await md5sum(srcFilePath);
  const fileType = await fileTypeFromFile(srcFilePath);
  if (fileType === undefined) {
    throw new FormatError('Failed to detect file type.')
  }
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'the-gear-of-seasons-probe-'));
  try {
    const filePath = path.join(tempDir, `probe.${fileType.ext}`);
    await fs.copyFile(srcFilePath, filePath);
    const timestamp = await (async () => {
      if (!fileType.mime.startsWith('image/')) {
        return undefined;
      }
      try {
        const tags = ExifReader.load(await fs.readFile(filePath), {
          expanded: true,
          includeTags: { exif: ['DateTimeDigitized', 'DateTimeOriginal'] },
        }).exif;
        // EXIF の DateTimeDigitized が CreateDate に相当する。オフセット・サブ秒は使わず、
        // タイムゾーンを持たない撮影日時をサーバーのローカル時刻として扱う。
        const timestamp = tags?.DateTimeDigitized?.value[0] || tags?.DateTimeOriginal?.value[0];
        if (typeof timestamp !== 'string') {
          return undefined;
        }
        const [year, month, day, hours, minutes, seconds] = timestamp.trim().split(/[-: ]/g).map(Number);
        const date = new Date(year, month - 1, day);
        if (!Number.isNaN(hours) && !Number.isNaN(minutes) && !Number.isNaN(seconds)) {
          date.setHours(hours);
          date.setMinutes(minutes);
          date.setSeconds(seconds);
        }
        const result = dayjs(Number.isNaN(+date) ? timestamp : date);
        return result.isValid() ? result : undefined;
      } catch (e) {
        return undefined;
      }
    })();
    const type: MediaType = (() => {
      if (fileType.mime.startsWith('video/')) {
        return 'video';
      } else if (fileType.mime.startsWith('image/')) {
        return 'image';
      } else if (fileType.mime.startsWith('audio/')) {
        return 'audio';
      } else {
        throw new FormatError(`Unsupported mime: ${fileType.mime}`);
      }
    })();
    switch (type) {
      case 'image': {
        const probeResult = await imageProbe(filePath);
        return {
          type: 'image',
          ext: fileType.ext,
          md5sum: hash,
          timestamp: timestamp,
          mimeType: fileType.mime,
          width: probeResult.width,
          height: probeResult.height,
        };
      }
      case 'video': {
        const probeResult = await avProbe(filePath);
        return {
          type: 'video',
          ext: fileType.ext,
          md5sum: hash,
          timestamp: timestamp,
          mimeType: fileType.mime,
          width: probeResult.width,
          height: probeResult.height,
          duration: probeResult.duration,
        };
      }
      case 'audio': {
        const probeResult = await avProbe(filePath);
        return {
          type: 'audio',
          ext: fileType.ext,
          md5sum: hash,
          timestamp: timestamp,
          mimeType: fileType.mime,
          duration: probeResult.duration,
        };
      }
      default:
        throw new Error('[FIXME] Unreachable code!');
    }
  } finally {
    await fs.rm(tempDir, {
      recursive: true,
      force: true,
    });
  }
}
