import spawn from '@expo/spawn-async';
import dayjs from 'dayjs';
import FormatError from './FormatError.js';

type RawTags = Record<string, string | undefined>;

type RawVideoStreamProbeResult = {
  readonly tags?: RawTags;
  codec_type: 'video';
  readonly width: number;
  readonly height: number;
};

type RawAudioStreamProbeResult = {
  codec_type: 'audio';
};

type RawProbeResult = {
  readonly streams: (RawVideoStreamProbeResult | RawAudioStreamProbeResult)[];
  readonly format: {
    readonly duration: number;
    readonly tags?: RawTags;
  };
};

export type AVProbeResult = {
  width?: number,
  height?: number,
  duration: number,
  timestamp: dayjs.Dayjs | undefined,
}

function videoTimestamp(format: RawTags | undefined, stream: RawTags | undefined): dayjs.Dayjs | undefined {
  // 撮影日時のタグをコンテナー・映像ストリームの順に読み、最後にヘッダーの作成日時を使う。
  const shotTags = ['com.apple.quicktime.creationdate', 'DateTimeOriginal', 'date'];
  const candidates = [
    ...shotTags.map((key) => format?.[key]),
    ...shotTags.map((key) => stream?.[key]),
    format?.creation_time,
    stream?.creation_time,
  ];
  for (const value of candidates) {
    if (typeof value !== 'string') {
      continue;
    }
    const parts = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value);
    if (parts === null) {
      continue;
    }
    const [, y, m, d, h, min, sec, zone] = parts;
    const year = Number(y), month = Number(m), day = Number(d);
    const hours = Number(h), minutes = Number(min), seconds = Number(sec);
    const calendar = new Date(0);
    calendar.setUTCFullYear(year, month - 1, day);
    if (year === 0 || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 ||
        calendar.getUTCDate() !== day || hours > 23 || minutes > 59 || seconds > 59) {
      continue;
    }
    // QuickTime/Unix のゼロ日時は撮影日時として使わない。
    if ((year === 1904 || year === 1970) && month === 1 && day === 1 && hours === 0 && minutes === 0 && seconds === 0) {
      continue;
    }
    if (zone && zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(-2)) > 59)) {
      continue;
    }
    const timestamp = dayjs(value);
    if (timestamp.isValid()) {
      return timestamp;
    }
  }
  return undefined;
}

export default async function avProbe(path: string): Promise<AVProbeResult> {
  const result = await spawn('ffprobe', [
    '-i', path,
    '-loglevel', 'quiet',
    '-hide_banner',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
  ]);
  if (result.status !== 0) {
    throw new Error(`Failed to probe: ${result.stderr}`);
  }
  const r = JSON.parse(result.stdout) as RawProbeResult;
  if (r.streams.length === 0) {
    throw new FormatError('No streams in the file');
  }
  const videoStream = r.streams.find((it) => it.codec_type === 'video');
  const audioStream = r.streams.find((it) => it.codec_type === 'audio');
  if (videoStream !== undefined) {
    return {
      width: videoStream.width,
      height: videoStream.height,
      duration: r.format.duration,
      timestamp: videoTimestamp(r.format.tags, videoStream.tags),
    };
  }
  if (audioStream !== undefined) {
    return {
      duration: r.format.duration,
      timestamp: undefined,
    };
  }
  throw new FormatError('Stream not found');
}
