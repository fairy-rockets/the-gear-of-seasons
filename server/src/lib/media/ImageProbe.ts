import spawn from '@expo/spawn-async';
import FormatError from './FormatError.js';

export default async function imageProbe(path: string): Promise<{width: number, height: number}> {
  const result = await spawn('magick', [
    'identify',
    '-format', '%[width],%[height]',
    path,
  ]);
  const [width, height] = result.stdout.split(',');
  return {
    width: parseInt(width),
    height: parseInt(height),
  };
}
