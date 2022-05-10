import * as fs from 'fs/promises';
import path from 'path';
import os from 'os';

import exifr from 'exifr';
import dayjs from 'dayjs';
import {fileTypeFromFile, MimeType} from 'file-type';

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
  readonly mimeType: MimeType;
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
      try {
        const exif = await exifr.parse(filePath);
        if (exif === undefined || exif === null) {
          return undefined;
        }
        const timestamp: Date | undefined = exif['CreateDate'] || exif['DateTimeOriginal'];
        if (timestamp === undefined) {
          return undefined;
        } else {
          return dayjs(timestamp);
        }
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
