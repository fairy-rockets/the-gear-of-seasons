import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
dayjs.extend(customParseFormat);

import { MomentStatus } from '../lib/protocol.js';

type Moment = {
  timestamp: dayjs.Dayjs | undefined;
  title: string;
  author: string;
  text: string;
  iconID: string | undefined;
  status: MomentStatus;
};

type MomentSummary = {
  timestamp: dayjs.Dayjs | undefined;
  title: string;
  iconID: string | undefined;
  status: MomentStatus;
};

// moment を引くときに、どこまで見せるか。
// omote（公開側）から引くときは必ず 'published'、ura（編集側）は 'all'。
// 呼び出し側に選ばせるため、Shelf/Repo の引数にデフォルト値は付けない。
type MomentVisibility = 'published' | 'all';

// 不正な値（欠けている場合も含む）は例外にする。draft や published に読み替えると、
// 古いクライアントからの保存で公開状態が黙って変わってしまうため。
export function parseMomentStatus(str: unknown): MomentStatus {
  if (str === 'draft' || str === 'published') {
    return str;
  }
  throw new Error(`Invalid moment status: ${str}`);
}

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

export {
  Moment,
  MomentSummary,
  MomentVisibility,
};
