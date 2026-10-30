import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
dayjs.extend(utc);

import {
  AnnotationField,
  EntityAnnotation,
  parseAnnotationMedium,
  parseAnnotationPalette,
  parseAnnotationRole,
  parseLooksChild,
  parseLooksNude,
} from './EntityAnnotation.js';

// エクスポートの hexe.yaml（CurationExport.ts）と、studio の投入用ファイル（CurationImport.ts）が共有する形式。
// 項目の名前と値は #2 のコメント（issuecomment-3603）の「1. DB に足すもの」。

export type AnnotationValue = EntityAnnotation[AnnotationField];

export function parseString(v: unknown): string {
  if (typeof v !== 'string') {
    throw new Error(`文字列ではありません: ${JSON.stringify(v)}`);
  }
  return v;
}

export function parseStrings(v: unknown): string[] {
  if (!Array.isArray(v) || !v.every((s) => typeof s === 'string')) {
    throw new Error(`文字列のリストではありません: ${JSON.stringify(v)}`);
  }
  return v;
}

export function parseBoolean(v: unknown): boolean {
  if (typeof v !== 'boolean') {
    throw new Error(`true か false ではありません: ${JSON.stringify(v)}`);
  }
  return v;
}

// 定義に無い値は、EntityAnnotation.ts の parse* が投げる例外の代わりに、ファイルの書き手に分かる文で返す。
export function parseEnum<T>(parse: (v: unknown) => T): (v: unknown) => T {
  return (v) => {
    try {
      return parse(v);
    } catch (_err) {
      throw new Error(`定義に無い値です: ${JSON.stringify(v)}`);
    }
  };
}

// メディアごとの項目。キーはファイル（hexe.yaml）の名前で、並びはエクスポートが書く順。
export const kMediaKeys: Record<string, [AnnotationField, (v: unknown) => AnnotationValue]> = {
  medium: ['medium', parseEnum(parseAnnotationMedium)],
  alt: ['alt', parseString],
  description: ['description', parseString],
  tags: ['tags', parseStrings],
  palette: ['palette', parseEnum(parseAnnotationPalette)],
  characters: ['characters', parseStrings],
  looks_nude: ['looksNude', parseEnum(parseLooksNude)],
  looks_child: ['looksChild', parseEnum(parseLooksChild)],
  looks_note: ['looksNote', parseString],
  human_verified: ['humanVerified', parseBoolean],
  role: ['role', parseEnum(parseAnnotationRole)],
  role_group: ['roleGroup', parseString],
  role_star: ['roleStar', parseBoolean],
  role_note: ['roleNote', parseString],
};

// moment の項目のうち、投入用ファイルに書けるもの。
export const kMomentKeys = ['moment', 'tier', 'series', 'sensitive', 'media'];

// moment の時刻の形。オフセット付きの ISO 8601。オフセットの無い時刻は、どの時間帯かが決まらないので通さない。
export const kMomentFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/;

// エクスポートが書く moment。時刻はサーバの時間帯によらず JST で書く（2017-07-26T02:46:00+09:00）。
export function formatMomentLabel(timestamp: dayjs.Dayjs): string {
  return toJST(timestamp).format('YYYY-MM-DDTHH:mm:ssZ');
}

export function toJST(timestamp: dayjs.Dayjs): dayjs.Dayjs {
  return timestamp.utcOffset(9 * 60);
}

// 形だけでなく、存在する日時か。存在しない日時（2017-02-30、25時など）は Temporal.Instant.from が例外にする。
// Temporal は 60 秒（うるう秒）を 59 秒に丸めて読むので、それだけは先に弾く。
export function isMomentLabel(label: string): boolean {
  if (!kMomentFormat.test(label) || label.slice(17, 19) === '60') {
    return false;
  }
  try {
    Temporal.Instant.from(label);
    return true;
  } catch (_err) {
    return false;
  }
}
