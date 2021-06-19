import spawn from '@expo/spawn-async';

export type ProbeResult = {
  codec_long_name: string,
  codec_type: string,
  width: number,
  height: number,
  duration: number,
};

export async function probe(path: string): Promise<ProbeResult> {
  const result = await spawn('ffprobe', [
    '-i', path,
    '-print_format', 'json',
    '-show_streams',
  ]);
  const stdout = result.output[0];
  const json = JSON.parse(stdout);
  return json['streams'][0] as ProbeResult;
}