import spawn from '@expo/spawn-async';

export async function resizeImage(src: string, dst: string, maxSize: number) {
  // https://www.bogotobogo.com/FFMpeg/ffmpeg_image_scaling_jpeg.php
  await spawn('ffmpeg', [
    '-i', src,
    '-vf', `scale='if(gt(a,${maxSize}/${maxSize}),${maxSize},-1)':'if(gt(a,${maxSize}/${maxSize}),-1,${maxSize})'`,
    '-f', 'image2',
    '-vframes', '1',
    dst
  ]);
}

export async function makeImageIcon(src: string, dst: string, size: number) {
  // https://stackoverflow.com/a/63856839
  await spawn('ffmpeg', [
    '-i', src,
    '-vf', `crop=w='min(iw\\,ih)':h='min(iw\\,ih)',scale=${size}:${size},setsar=1`,
    '-f', 'image2',
    '-vframes', '1',
    dst
  ]);
}

export async function makeVideoIcon(src: string, dst: string, at: number, size: number) {
  await spawn('ffmpeg', [
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
    '-i', src,
    '-ss', at.toFixed(2),
    '-filter_complex', `[0:a]showwaves=s=${size}x${size}:mode=line:rate=25,format=yuv444p[v]`,
    '-pix_fmt', 'yuvj444p',
    '-f', 'image2',
    '-vframes', '1',
    dst
  ]);
}
