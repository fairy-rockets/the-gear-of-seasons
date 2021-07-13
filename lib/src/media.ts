import spawn from '@expo/spawn-async';

export type MediaType = 'image' | 'video' | 'audio';

export type MimeType = 
  // image
  'image/jpeg' |
  'image/png' |
  'image/gif' |
  // audio
  'audio/mpeg' | // mp3
  'audio/flac' |
  'audio/webm' |
  'audio/mp4' |
  'audio/x-matroska' |
  // video
  'video/mp4' |
  'video/x-matroska' |
  'video/webm' ;


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
    readonly codec_name: string,
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
  let width: number | null;
  let height: number | null;
  let duration: number | null;

  if (r.streams.length === 0) {
    throw new FormatError('No streams in the file');
  }

  const videoStream = r.streams.find((it) => it.codec_type == 'video');
  const audioStream = r.streams.find((it) => it.codec_type == 'audio');

  switch (r.format.format_long_name) {
    case 'QuickTime / MOV':
      if (videoStream !== undefined) {
        type = 'video';
        mimeType = 'video/mp4';
      } else if (audioStream !== undefined) {
        type = 'audio';
        mimeType = 'audio/mp4';
      } else {
        throw new FormatError('No media in QuickTime file.');
      }
      break;
    case 'Matroska / WebM':
      if (videoStream !== undefined) {
        switch (videoStream.codec_long_name) {
          case 'On2 VP8':
          case 'Google VP9':
          case 'Alliance for Open Media AV1':
            type = 'video';
            mimeType = 'video/webm';
            break;
          default:
            type = 'video';
            mimeType = 'video/x-matroska';
            break;
        }
      } else if (audioStream !== undefined) {
        switch (audioStream.codec_long_name) {
          case 'Vorbis':
          case 'Opus (Opus Interactive Audio Codec)':
            type = 'audio';
            mimeType = 'audio/webm';
            break;
          default:
            type = 'audio';
            mimeType = 'audio/x-matroska';
            break;
        }
      } else {
        throw new FormatError('No media in mkv/webm file.');
      }
      break;
    case 'image2 sequence': //JPEG?
      if (videoStream !== undefined) {
        switch (videoStream.codec_long_name) {
          case 'Motion JPEG':
            type = 'image';
            mimeType = 'image/jpeg';
            break;
          default:
            throw new FormatError('Unsupported format: '+videoStream.codec_long_name);
        }
      } else {
        throw new FormatError('No images in jpeg file.')
      }
      break;
    case 'piped png sequence': // PNG
      if (videoStream !== undefined) {
        type = 'image';
        mimeType = 'image/png';
      } else {
        throw new FormatError('No images in png file.')
      }
      break;
    case 'CompuServe Graphics Interchange Format (GIF)':
      if (videoStream !== undefined) {
        type = 'image';
        mimeType = 'image/gif';
      } else {
        throw new FormatError('No images in gif file.')
      }
      break;
    case 'FLAC (Free Lossless Audio Codec)':
      if (audioStream !== undefined) {
        type = 'audio';
        mimeType = 'audio/flac';
      } else {
        throw new FormatError('No audio in flac file.')
      }
      break;
    default:
      throw new FormatError('Unsupported format');
  }

  switch (type) {
    case 'image':
      width = videoStream!!.width;
      height = videoStream!!.height;
      duration = null;
      break;
    case 'video':
      width = videoStream!!.width;
      height = videoStream!!.height;
      duration = videoStream!!.duration!!;
      break;
    case 'audio':
      width = null;
      height = null;
      duration = audioStream!!.duration!!;
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