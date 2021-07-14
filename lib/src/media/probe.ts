import spawn from '@expo/spawn-async';
import md5sum from '../md5sum';
import exifr from 'exifr';
import dayjs from 'dayjs';
import FileType from 'file-type';

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
  const stdout = result.output[0];
  const r = JSON.parse(stdout) as RawProbeResult;
  if (r.streams.length === 0) {
    throw new FormatError('No streams in the file');
  }
  const videoStream = r.streams.find((it) => it.codec_type === 'video');
  const audioStream = r.streams.find((it) => it.codec_type === 'audio');
  switch (type) {
    case 'video':
      if (videoStream === undefined) {
        throw new FormatError('No video streams');
      }
      return {
        width: videoStream.width,
        height: videoStream.height,
        duration: videoStream.duration,
      }
    case 'image':
      if (videoStream === undefined) {
        throw new FormatError('No images');
      }
      return {
        width: videoStream.width,
        height: videoStream.height,
      }
    case 'audio':
      if (audioStream === undefined) {
        throw new FormatError('No audio streams');
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

export async function probe(path: string): Promise<ProbeResult> {
  const hash = await md5sum(path);
  const fileType = await FileType.fromFile(path);
  if (fileType === undefined) {
    throw new FormatError('Failed to detect file type.')
  }
  const timestamp = await (async () => {
    const exif = await exifr.parse(path);
    if (exif === undefined || exif === null) {
      return undefined;
    }
    const timestamp: Date | undefined = exif['CreateDate'];
    if (timestamp === undefined) {
      return undefined;
    } else {
      return dayjs(timestamp);
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
  const avResult = await avProbe(path, type);
  switch (type) {
    case 'image':
      return {
        type: 'image',
        md5sum: hash,
        timestamp: timestamp,
        mimeType: fileType.mime,
        width: avResult.width,
        height: avResult.height,
      };
    case 'video':
      return {
        type: 'video',
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
        md5sum: hash,
        timestamp: timestamp,
        mimeType: fileType.mime,
        duration: avResult.duration,
      };
  }
}
