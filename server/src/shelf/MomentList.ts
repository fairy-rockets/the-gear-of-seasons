import * as fml from '../lib/fml.js';
import * as protocol from '../lib/protocol.js';
import { EntityAnnotation } from './EntityAnnotation.js';
import { Moment, formatMomentPath, formatMomentTime } from './Moment.js';

// ura の一覧（/moments/）の要約を作る。

export type MediaRef = {
  entity: string;
  type: protocol.EntityType;
};

// 本文の [image]・[video]・[audio] の entity と、そのブロックの型。出てくる順に、同じ entity は1回だけ（最初のブロックの型）。
export function momentMedia(doc: fml.Document): MediaRef[] {
  const found = new Map<string, protocol.EntityType>();
  for (const block of doc.blocks) {
    if ((block.type === 'image' || block.type === 'video' || block.type === 'audio') && block.entity !== undefined) {
      if (!found.has(block.entity)) {
        found.set(block.entity, block.type);
      }
    }
  }
  return [...found].map(([entity, type]) => ({ entity, type }));
}

// 注釈の行が無い entity の値。
const kNoAnnotation = protocol.emptyAnnotationValues();

// 検索に使う本文の文章。text ブロックと [link] の text をつないだもので、fml の記法（[image entity="…"] など）は含まない。
export function momentBodyText(doc: fml.Document): string {
  const texts: string[] = [];
  for (const block of doc.blocks) {
    if (block.type === 'text') {
      texts.push(block.text);
    } else if (block.type === 'link' && block.text !== undefined) {
      texts.push(block.text);
    }
  }
  return texts.join('\n');
}

// doc は m.text をパースしたもの。annotations には、本文のメディアの注釈が入っていること（行が無い entity は入っていなくてよい）。
export function momentListItem(m: Moment, doc: fml.Document, annotations: ReadonlyMap<string, EntityAnnotation>): protocol.Moment.List.Item {
  const media = momentMedia(doc);
  let unentered = 0;
  let unverified = 0;
  for (const { entity, type } of media) {
    const state = protocol.annotationState(type, annotations.get(entity) ?? kNoAnnotation);
    if (state === 'unentered') {
      unentered++;
    } else if (state === 'unverified') {
      unverified++;
    }
  }
  return {
    path: formatMomentPath(m.timestamp!!),
    date: formatMomentTime(m.timestamp!!),
    title: m.title,
    author: m.author,
    bodyText: momentBodyText(doc),
    iconID: m.iconID ?? null,
    status: m.status,
    tier: m.tier,
    series: m.series,
    sensitive: m.sensitive,
    sensitiveManual: m.sensitiveManual,
    media: media.length,
    unentered,
    unverified,
  };
}
