import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);

type Moment = {
  timestamp: dayjs.Dayjs | undefined;
  title: string;
  author: string;
  text: string;
  iconID: string | undefined;
};

const kMomentTimeFormat = 'YYYY/MM/DD HH:mm:ss';
const kMomentPathFormat = '/YYYY/MM/DD/HH:mm:ss/';

export function parseMomentPath(str: string): dayjs.Dayjs {
  return dayjs(str, kMomentPathFormat);
}

export function formatMomentPath(time: dayjs.Dayjs): string {
  return time.format(kMomentPathFormat);
}

export function parseMomentTime(str: string): dayjs.Dayjs {
  return dayjs(str, kMomentTimeFormat);
}

export function formatMomentTime(time: dayjs.Dayjs): string {
  return time.format(kMomentTimeFormat);
}

export default Moment;
