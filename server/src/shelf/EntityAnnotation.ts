import { Entity } from './Entity.js';

// メディア（entity）ごとの注釈。entity_annotations の1行で、entities と1対1。
// null は「値なし」（未入力）で、'none' や空のリストとは別の値として扱う。
// 項目の意味は #2 のコメント（issuecomment-3603）の「1. DB に足すもの」の表。

const kMedia = ['drawing', 'photo', '3d', 'generated', 'graphic'] as const;
const kPalettes = ['color', 'monochrome'] as const;
const kLooksNude = ['nude', 'partial', 'unclear', 'none'] as const;
const kLooksChild = ['child', 'ambiguous', 'adult', 'none'] as const;
const kRoles = ['grab', 'both', 'deep', 'none'] as const;

export type AnnotationMedium = typeof kMedia[number];
export type AnnotationPalette = typeof kPalettes[number];
export type LooksNude = typeof kLooksNude[number];
export type LooksChild = typeof kLooksChild[number];
export type AnnotationRole = typeof kRoles[number];

export type EntityAnnotation = {
  entityID: string;
  medium: AnnotationMedium | null;
  alt: string | null;
  description: string | null;
  tags: string[] | null;
  palette: AnnotationPalette | null;
  characters: string[] | null;
  looksNude: LooksNude | null;
  looksChild: LooksChild | null;
  looksNote: string | null;
  checked: boolean;
  role: AnnotationRole | null;
  roleGroup: string | null;
  roleStar: boolean | null;
  roleNote: string | null;
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
  return parseNullable('medium', kMedia, v);
}

export function parseAnnotationPalette(v: unknown): AnnotationPalette | null {
  return parseNullable('palette', kPalettes, v);
}

export function parseLooksNude(v: unknown): LooksNude | null {
  return parseNullable('looks_nude', kLooksNude, v);
}

export function parseLooksChild(v: unknown): LooksChild | null {
  return parseNullable('looks_child', kLooksChild, v);
}

export function parseAnnotationRole(v: unknown): AnnotationRole | null {
  return parseNullable('role', kRoles, v);
}

// 音声が持たない項目。音声には alt・description・tags だけがある。
const kNotForAudio: (keyof EntityAnnotation)[] = [
  'medium', 'palette', 'characters', 'looksNude', 'looksChild', 'looksNote',
  'role', 'roleGroup', 'roleStar', 'roleNote',
];

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
  if (entity.type === 'audio') {
    for (const key of kNotForAudio) {
      if (annotation[key] !== null) {
        throw new Error(`Audio entity ${entity.id} cannot have ${key}`);
      }
    }
    // checked も音声には無い項目だが、列が NOT NULL なので null にはできない。false（既定値）だけを通す。
    if (annotation.checked) {
      throw new Error(`Audio entity ${entity.id} cannot have checked`);
    }
  }
}
