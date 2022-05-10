import spawn from '@expo/spawn-async';
import FormatError from './FormatError.js';

type RawProbeResult = {
  readonly streams: {
    readonly codec_type: string;
    readonly width: number;
    readonly height: number;
    readonly duration?: number;
  }[];
};

export type AVProbeResult = {
  width?: number,
  height?: number,
  duration?: number,
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
      duration: videoStream.duration,
    };
  }
  if (audioStream !== undefined) {
    return {
      duration: audioStream.duration,
    };
  }
  throw new FormatError('Stream not found');
}
