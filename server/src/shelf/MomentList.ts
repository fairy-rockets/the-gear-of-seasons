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

// 注釈の行が無い entity の値。列の既定値（human_verified は false、ほかは null）。
const kNoAnnotation: protocol.AnnotationValues = {
  medium: null, alt: null, description: null, tags: null, palette: null, characters: null,
  looksNude: null, looksChild: null, looksNote: null, humanVerified: false,
  role: null, roleGroup: null, roleStar: null, roleNote: null,
};

// annotations には、本文のメディアの注釈が入っていること（行が無い entity は入っていなくてよい）。
export function momentListItem(m: Moment, media: MediaRef[], annotations: ReadonlyMap<string, EntityAnnotation>): protocol.Moment.List.Item {
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
    text: m.text,
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
