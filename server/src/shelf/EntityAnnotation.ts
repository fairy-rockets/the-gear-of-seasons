import { Entity } from './Entity.js';
import {
  AnnotationField,
  AnnotationMedium,
  AnnotationPalette,
  AnnotationRole,
  AnnotationValues,
  LooksChild,
  LooksNude,
  kAnnotationFields,
  kAnnotationFieldsByType,
  kAnnotationMedia,
  kAnnotationPalettes,
  kAnnotationRoles,
  kLooksChild,
  kLooksNude,
} from '../lib/protocol.js';

// メディア（entity）ごとの注釈。entity_annotations の1行で、entities と1対1。
// 選べる値と項目は、ura の編集画面と共有するので protocol.ts にある。
// null は「値なし」（未入力）で、'none' や空のリストとは別の値として扱う。

export type EntityAnnotation = { entityID: string } & AnnotationValues;

export {
  AnnotationField,
  AnnotationMedium,
  AnnotationPalette,
  AnnotationRole,
  LooksChild,
  LooksNude,
};

// 不正な値は例外にする（parseMomentStatus と同じ）。null は「値なし」としてそのまま通す。
function parseNullable<T extends string>(name: string, values: readonly T[], v: unknown): T | null {
  if (v === null) {
    return null;
  }
  if ((values as readonly unknown[]).includes(v)) {
    return v as T;
  }
  throw new Error(`Invalid ${name}: ${v}`);
}

export function parseAnnotationMedium(v: unknown): AnnotationMedium | null {
  return parseNullable('medium', kAnnotationMedia, v);
}

export function parseAnnotationPalette(v: unknown): AnnotationPalette | null {
  return parseNullable('palette', kAnnotationPalettes, v);
}

export function parseLooksNude(v: unknown): LooksNude | null {
  return parseNullable('looks_nude', kLooksNude, v);
}

export function parseLooksChild(v: unknown): LooksChild | null {
  return parseNullable('looks_child', kLooksChild, v);
}

export function parseAnnotationRole(v: unknown): AnnotationRole | null {
  return parseNullable('role', kAnnotationRoles, v);
}

// 種類ごとに持つ項目。Record にしてあるので、entity の種類を足すと、protocol.ts の kAnnotationFieldsByType に
// 足すまでコンパイルが通らない。
export const kFieldsByType: Record<Entity['type'], readonly AnnotationField[]> = kAnnotationFieldsByType;

// 書き込む前に、値が定義にあるか、その種類の entity が持つ項目だけかを確かめる。合わなければ例外にする。
// DB を触らないので、書き込まずに確かめるだけのとき（#43 の変更内容だけを出すモードなど）にも使える。
export function validateEntityAnnotation(entity: Entity, annotation: EntityAnnotation) {
  if (annotation.entityID !== entity.id) {
    throw new Error(`Annotation for ${annotation.entityID} does not belong to entity ${entity.id}`);
  }
  parseAnnotationMedium(annotation.medium);
  parseAnnotationPalette(annotation.palette);
  parseLooksNude(annotation.looksNude);
  parseLooksChild(annotation.looksChild);
  parseAnnotationRole(annotation.role);
  const fields = kFieldsByType[entity.type];
  for (const key of kAnnotationFields) {
    if (fields.includes(key)) {
      continue;
    }
    // checked は列が NOT NULL なので null にはできない。持たない種類では false（既定値）だけを通す。
    const absent = key === 'checked' ? annotation[key] === false : annotation[key] === null;
    if (!absent) {
      throw new Error(`${entity.type} entity ${entity.id} cannot have ${key}`);
    }
  }
}
