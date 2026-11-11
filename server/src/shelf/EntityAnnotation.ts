import { Entity } from './Entity.js';
import {
  AnnotationField,
  AnnotationMethod,
  AnnotationPalette,
  AnnotationValues,
  canHaveMaterials,
  kAnnotationFields,
  kAnnotationFieldsByType,
  kAnnotationMethods,
  kAnnotationPalettes,
} from '../lib/protocol.js';

// メディア（entity）ごとの注釈。entity_annotations の1行で、entities と1対1。
// 選べる値と項目は、ura の編集画面と共有するので protocol.ts にある。
// null は「値なし」（未入力）で、'none' や空のリストとは別の値として扱う。

export type EntityAnnotation = { entityID: string } & AnnotationValues;

// 画像の説明として表に出す alt。human_verified は問わない（確認前でも一律の文言よりは説明になる）。
// 未入力や空白だけのときは null で、呼び出し側がそれぞれの代わりの文言に落とす。
export function displayAlt(annotation: EntityAnnotation | null | undefined): string | null {
  if (annotation === null || annotation === undefined || annotation.alt === null || annotation.alt.trim() === '') {
    return null;
  }
  return annotation.alt;
}

export {
  AnnotationField,
  AnnotationMethod,
  AnnotationPalette,
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

// methods を、空でなく重複の無い kAnnotationMethods の値の集合として読み、kAnnotationMethods の順に並べて返す。
// 合わなければ例外にする。null は「値なし」としてそのまま通す。
export function parseAnnotationMethods(v: unknown): AnnotationMethod[] | null {
  if (v === null) {
    return null;
  }
  if (!Array.isArray(v)) {
    throw new Error(`Invalid methods: ${JSON.stringify(v)}`);
  }
  if (v.length === 0) {
    throw new Error('Invalid methods: empty');
  }
  for (const m of v) {
    if (!(kAnnotationMethods as readonly unknown[]).includes(m)) {
      throw new Error(`Invalid methods: ${JSON.stringify(m)}`);
    }
  }
  if (new Set(v).size !== v.length) {
    throw new Error(`Invalid methods: duplicated: ${JSON.stringify(v)}`);
  }
  return kAnnotationMethods.filter((m) => v.includes(m));
}

export function parseAnnotationPalette(v: unknown): AnnotationPalette | null {
  return parseNullable('palette', kAnnotationPalettes, v);
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
  const methods = parseAnnotationMethods(annotation.methods);
  // 並びをそろえていない methods は、parseAnnotationMethods を通していない値なので弾く（書いた値と読む値を同じにする）。
  if (JSON.stringify(methods) !== JSON.stringify(annotation.methods)) {
    throw new Error(`methods is not in the order of kAnnotationMethods: ${JSON.stringify(annotation.methods)}`);
  }
  parseAnnotationPalette(annotation.palette);
  const fields = kFieldsByType[entity.type];
  for (const key of kAnnotationFields) {
    if (!fields.includes(key) && annotation[key] !== null) {
      throw new Error(`${entity.type} entity ${entity.id} cannot have ${key}`);
    }
  }
  if (annotation.materials !== null && !canHaveMaterials(annotation.methods)) {
    throw new Error(`${entity.type} entity ${entity.id} cannot have materials unless methods includes draw`);
  }
}
