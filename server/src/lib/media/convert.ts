import spawn from '@expo/spawn-async';

export async function resizeImage(src: string, dst: string, maxSize: number) {
  // https://legacy.imagemagick.org/Usage/resize/
  await spawn('magick', [
    'convert',
    src,
    '-resize', `${maxSize}x${maxSize}`,
    dst
  ]);
}

export async function makeImageIcon(src: string, dst: string, size: number) {
  // https://legacy.imagemagick.org/Usage/resize/
  await spawn('magick', [
    'convert',
    src,
    '-resize', `${size}x${size}`,
    '-gravity', 'center',
    '-extent', `${size}x${size}`,
    dst
  ]);
}

export async function makeVideoIcon(src: string, dst: string, at: number, size: number) {
  await spawn('ffmpeg', [
    '-hide_banner',
    '-i', src,
    '-ss', at.toFixed(2),
    '-vf', `crop=w='min(iw\\,ih)':h='min(iw\\,ih)',scale=${size}:${size},setsar=1`,
    '-f', 'image2',
    '-vframes', '1',
    dst
  ]);
}

export async function makeAudioIcon(src: string, dst: string, at: number, size: number) {
  await spawn('ffmpeg', [
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
}
