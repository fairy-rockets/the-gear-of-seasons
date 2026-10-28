import * as fml from '../lib/fml.js';
import { EntityAnnotation } from './EntityAnnotation.js';

// sensitive の計算に使う entity。本文（FML）の [image] と [video] に出てくるもので、
// [audio] や [link] は数えない。同じ entity が2回出てきても1回だけ返す。
export function sensitiveTargetEntityIDs(doc: fml.Document): string[] {
  const ids = new Set<string>();
  for (const block of doc.blocks) {
    if ((block.type === 'image' || block.type === 'video') && block.entity !== undefined) {
      ids.add(block.entity);
    }
  }
  return [...ids];
}

// moment の sensitive の自動の値。対象の entity のうち、注釈が looks_nude = nude かつ
// looks_child = child のものが1つでもあれば true。注釈が無い・未入力（null）の entity は数えない。
// sensitive_manual = true の moment にこの値を書き込まないのは、呼び出す側の責任。
export function computeSensitive(doc: fml.Document, annotations: ReadonlyMap<string, EntityAnnotation>): boolean {
  for (const id of sensitiveTargetEntityIDs(doc)) {
    const a = annotations.get(id);
    if (a !== undefined && a.looksNude === 'nude' && a.looksChild === 'child') {
      return true;
    }
  }
  return false;
}
