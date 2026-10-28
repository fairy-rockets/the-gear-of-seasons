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

// キュレーションの項目。ura の SAVE は送ってこないので、Moment（本文の側）とは分けて持ち、
// SAVE では書き換えない。書くのは専用のメソッド（Shelf.updateMomentCuration など）だけ。
// TODO: 編集画面がこれらの項目も送るようになったら、Moment にまとめ、SAVE で全部書く（#46）。
type MomentTier = 'pickup' | 'archive' | 'sketch' | 'hidden';

type MomentCuration = {
  tier: MomentTier;
  series: string[];
  // sensitiveManual が false の間は、本文と entity_annotations から計算した値（Sensitive.ts）を書き込むたびに保つ。
  sensitive: boolean;
  sensitiveManual: boolean;
};

type CuratedMoment = Moment & MomentCuration;

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
  MomentCuration,
  CuratedMoment,
  MomentSummary,
  MomentVisibility,
};
