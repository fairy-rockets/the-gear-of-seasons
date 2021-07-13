import spawn from '@expo/spawn-async';

export type MediaType = 'image' | 'video' | 'audio';

export type MimeType = 
  // image
  'image/jpeg' |
  'image/png' |
  'image/gif' |
  // audio
  'audio/mpeg' | // mp3
  'audio/flac' |  // flac
  // video
  'video/mp4' |
  'video/x-matroska';


export type ProbeResult = {
  readonly type: MediaType;
  readonly mimeType: MimeType,
  readonly width: number | null,
  readonly height: number | null,
  readonly duration: number | null,  

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

type RawProbeResult = {
  readonly streams: {
    readonly codec_long_name: string,
    readonly codec_type: string,
    readonly width: number,
    readonly height: number,
    readonly duration: number | undefined,
    readonly duration_ts: number | undefined,
  }[];
  readonly format: {
    readonly format_name: string,
    readonly format_long_name: string,
  }
};

export async function probe(path: string): Promise<ProbeResult> {
  const result = await spawn('ffprobe', [
    '-i', path,
    '-loglevel', 'quiet',
    '-hide_banner',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
  ]);
  const stdout = result.output[0];
  const json = JSON.parse(stdout);
  return analyzeRawResult(json['streams'][0] as RawProbeResult);
}

function analyzeRawResult(r: RawProbeResult): ProbeResult {
  let type: MediaType;
  let mimeType: MimeType;
  if (r.streams.length === 0) {
    throw new FormatError('No streams in the file');
  }
  const s = r.streams[0];
  let width: number | null = s.width;
  let height: number | null = s.height;
  let duration: number | null = s.duration !== undefined ? s.duration : null;

  if (r.streams.length === 1) {
    switch (s.codec_type) {
      case 'mjpeg':
        if (s.duration === undefined || s.duration_ts === 1) {
          type = 'image';
          mimeType = 'image/jpeg';
        } else {
          throw new FormatError('Motion JPEG is not supported!');
        }
        break;
      case 'png':
        if (r.streams[0].duration === undefined || r.streams[0].duration_ts === 1) {
          type = 'image';
          mimeType = 'image/png';
        } else {
          throw new FormatError('APNG is not supported!');
        }
        break;
      case 'gif':
        type = 'image';
        mimeType = 'image/gif';
        break;
      case 'flag':
        type = 'audio';
        mimeType = 'audio/flac';
        break;
      default:
        throw new FormatError('Unsupported format');
    }
  } else {
    switch (s.codec_type) {
      case 'h264':
        if (r.format.format_long_name === 'QuickTime / MOV') {
          type = 'video';
          mimeType = 'video/mp4';
        } else {
          throw new FormatError('Unsupported container for h264');
        }
        break;
      default:
        throw new FormatError('Unsupported format');
    }
  }


  switch (type) {
    case 'image':
      duration = null;
      break;
    case 'video':
      break;
    case 'audio':
      width = null;
      height = null;
      break;
  }

  return {
    type: type,
    mimeType: mimeType,
    width: width,
    height: height,
    duration: duration
  };
}