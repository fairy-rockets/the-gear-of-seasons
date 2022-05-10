import spawn from '@expo/spawn-async';

export async function resizeImage(src: string, dst: string, maxSize: number) {
  // https://legacy.imagemagick.org/Usage/resize/
  const r = await spawn('magick', [
    'convert',
    src,
    '-coalesce',
    '-resize', `${maxSize}x${maxSize}`,
    dst
  ]);
  if(r.status !== 0) {
    throw new Error(`Failed to convert: ${r.stderr}`);
  }
}

export async function makeImageIcon(src: string, dst: string, size: number) {
  // https://legacy.imagemagick.org/Usage/resize/
  const r = await spawn('magick', [
    'convert',
    src,
    '-coalesce',
    '-resize', `${size}x${size}^`,
    '-gravity', 'center',
    '-extent', `${size}x${size}`,
    dst
  ]);
  if(r.status !== 0) {
    throw new Error(`Failed to convert: ${r.stderr}`);
  }
}

export async function makeVideoIcon(src: string, dst: string, at: number, size: number) {
  const r = await spawn('ffmpeg', [
    '-hide_banner',
    '-i', src,
    '-ss', at.toFixed(2),
    '-vf', `crop=w='min(iw\\,ih)':h='min(iw\\,ih)',scale=${size}:${size},setsar=1`,
    '-f', 'image2',
    '-vframes', '1',
    dst
  ]);
  if(r.status !== 0) {
    throw new Error(`Failed to convert: ${r.stderr}`);
  }
}

export async function makeAudioIcon(src: string, dst: string, at: number, size: number) {
  const r = await spawn('ffmpeg', [
    '-hide_banner',
    '-i', src,
    '-ss', at.toFixed(2),
    '-filter_complex', `[0:a]showwaves=s=${size}x${size}:mode=line:rate=25,format=yuv444p[v]`,
    '-map', '[v]',
    '-pix_fmt', 'yuvj444p',
    '-f', 'image2',
    '-vframes', '1',
    dst
  ]);
  if(r.status !== 0) {
    throw new Error(`Failed to convert: ${r.stderr}`);
  }
}
