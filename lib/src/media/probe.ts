import * as fs from 'fs/promises';
import path from 'path';
import os from 'os';

import spawn from '@expo/spawn-async';
import exifr from 'exifr';
import dayjs from 'dayjs';
import FileType from 'file-type';

import md5sum from '../md5sum';

export type MediaType = 'image' | 'video' | 'audio';

type RawProbeResult = {
  readonly streams: {
    readonly codec_type: string;
    readonly width: number;
    readonly height: number;
    readonly duration?: number;
  }[];
};

type AVProbeResult = {
  width?: number,
  height?: number,
  duration?: number,
}

async function avProbe(path: string, type: MediaType): Promise<AVProbeResult> {
  const result = await spawn('ffprobe', [
    '-i', path,
    '-loglevel', 'quiet',
    '-hide_banner',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
  ]);
  const r = JSON.parse(result.stdout) as RawProbeResult;
  if (r.streams.length === 0) {
    throw new FormatError('No streams in the file');
  }
  const videoStream = r.streams.find((it) => it.codec_type === 'video');
  const audioStream = r.streams.find((it) => it.codec_type === 'audio');
  switch (type) {
    case 'video':
      if (videoStream === undefined) {
        throw new FormatError('Video stream not found');
      }
      return {
        width: videoStream.width,
        height: videoStream.height,
        duration: videoStream.duration,
      }
    case 'image':
      if (videoStream === undefined) {
        throw new FormatError('Image stream not found');
      }
      return {
        width: videoStream.width,
        height: videoStream.height,
      }
    case 'audio':
      if (audioStream === undefined) {
        throw new FormatError('Audio stream not found');
      }
      return {
        duration: audioStream.duration,
      }
  }
}

// ------
// exports
// ------

export type ProbeResult = {
  readonly type: MediaType;
  readonly ext: string;
  readonly md5sum: string;
  readonly timestamp: dayjs.Dayjs | undefined;
  readonly mimeType: FileType.MimeType;
  readonly width?: number;
  readonly height?: number;
  readonly duration?: number;
};

export class FormatError extends Error {
  readonly name: string = 'FormatError';
  constructor (message: string) {
    // https://stackoverflow.com/a/58417721
    super(message);
    this.name = 'FormatError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export async function probe(srcFilePath: string): Promise<ProbeResult> {
  const hash = await md5sum(srcFilePath);
  const fileType = await FileType.fromFile(srcFilePath);
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
    const avResult = await avProbe(filePath, type);
    switch (type) {
      case 'image':
        return {
          type: 'image',
          ext: fileType.ext,
          md5sum: hash,
          timestamp: timestamp,
          mimeType: fileType.mime,
          width: avResult.width,
          height: avResult.height,
        };
      case 'video':
        return {
          type: 'video',
          ext: fileType.ext,
          md5sum: hash,
          timestamp: timestamp,
          mimeType: fileType.mime,
          width: avResult.width,
          height: avResult.height,
          duration: avResult.duration,
        };
      case 'audio':
        return {
          type: 'audio',
          ext: fileType.ext,
          md5sum: hash,
          timestamp: timestamp,
          mimeType: fileType.mime,
          duration: avResult.duration,
        };
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
