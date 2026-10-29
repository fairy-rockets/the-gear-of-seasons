import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
dayjs.extend(customParseFormat);

import { MomentStatus, MomentTier } from '../lib/protocol.js';

type Moment = {
  timestamp: dayjs.Dayjs | undefined;
  title: string;
  author: string;
  text: string;
  iconID: string | undefined;
  status: MomentStatus;
  // 以下、キュレーションの項目。
  tier: MomentTier;
  series: string[];
  // sensitiveManual が false の間は、本文と entity_annotations から計算した値（Sensitive.ts）を書き込むたびに保つ。
  sensitive: boolean;
  sensitiveManual: boolean;
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

export function parseMomentTier(str: unknown): MomentTier {
  if (str === 'pickup' || str === 'archive' || str === 'sketch' || str === 'hidden') {
    return str;
  }
  throw new Error(`Invalid moment tier: ${str}`);
}

export function parseMomentSeries(v: unknown): string[] {
  if (Array.isArray(v) && v.every((s) => typeof s === 'string')) {
    return v;
  }
  throw new Error(`Invalid moment series: ${JSON.stringify(v)}`);
}

// sensitive の手での上書き。null は自動。欠けている（undefined）ときも例外にする（自動に読み替えない）。
export function parseSensitiveOverride(v: unknown): boolean | null {
  if (v === null || v === true || v === false) {
    return v;
  }
  throw new Error(`Invalid sensitive override: ${v}`);
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
  MomentTier,
  MomentSummary,
  MomentVisibility,
};
