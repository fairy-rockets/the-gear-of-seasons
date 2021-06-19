import spawn from '@expo/spawn-async';

export async function probe(path: string) {
  const result = await spawn('ffprobe', [
    '-i', path,
    '-print_format json',
    '-show_streams',
  ]);
  const stdout = result.output[0];
}