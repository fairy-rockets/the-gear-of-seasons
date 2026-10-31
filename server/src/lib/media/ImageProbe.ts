import spawn from '@expo/spawn-async';
import dayjs from 'dayjs';

export type ImageProbeResult = {
  width: number;
  height: number;
  timestamp: dayjs.Dayjs | undefined;
};

function imageTimestamp(value: string | undefined): dayjs.Dayjs | undefined {
  if (!value) {
    return undefined;
  }
  // EXIF はオフセット・サブ秒を使わず、サーバーのローカル時刻として扱う。
  const [year, month, day, hours, minutes, seconds] = value.trim().split(/[-: ]/g).map(Number);
  const date = new Date(year, month - 1, day);
  if (!Number.isNaN(hours) && !Number.isNaN(minutes) && !Number.isNaN(seconds)) {
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(seconds);
  }
  const result = dayjs(Number.isNaN(+date) ? value : date);
  return result.isValid() ? result : undefined;
}

export default async function imageProbe(path: string): Promise<ImageProbeResult> {
  const result = await spawn('magick', [
    'identify',
    '-quiet',
    '-format', '%[width],%[height]\n%[EXIF:DateTimeDigitized]\n%[EXIF:DateTimeOriginal]',
    `${path}[0]`,
  ]);
  const fields = result.stdout.split('\n');
  const [width, height] = fields[0].split(',');
  // DateTimeDigitized が CreateDate に相当する。改行を含む不正なメタデータは無視する。
  const timestamp = fields.length === 3 ? imageTimestamp(fields[1] || fields[2]) : undefined;
  return {
    width: parseInt(width),
    height: parseInt(height),
    timestamp,
  };
}
