
// draft は ura でだけ見える。omote に出るのは published だけ。
export type MomentStatus = 'draft' | 'published';

export type MomentTier = 'pickup' | 'archive' | 'sketch' | 'hidden';

export type EntityType = 'image' | 'video' | 'audio';

// メディア（entity）ごとの注釈の、選べる値。null は「値なし」（未入力）で、'none' とは別の値として扱う。
// 項目の意味は #2 のコメント（issuecomment-3603）の「1. DB に足すもの」の表。
export const kAnnotationMedia = ['drawing', 'photo', '3d', 'generated', 'graphic'] as const;
export const kAnnotationPalettes = ['color', 'monochrome'] as const;
export const kLooksNude = ['nude', 'partial', 'unclear', 'none'] as const;
export const kLooksChild = ['child', 'ambiguous', 'adult', 'none'] as const;
export const kAnnotationRoles = ['grab', 'both', 'deep', 'none'] as const;

export type AnnotationMedium = typeof kAnnotationMedia[number];
export type AnnotationPalette = typeof kAnnotationPalettes[number];
export type LooksNude = typeof kLooksNude[number];
export type LooksChild = typeof kLooksChild[number];
export type AnnotationRole = typeof kAnnotationRoles[number];

// 注釈の項目。entity_annotations の1行から entity_id を除いたもの。
// null は「値なし」（未入力）で、空の文字列・空のリストとは別の値として扱う。
export type AnnotationValues = {
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

export type AnnotationField = keyof AnnotationValues;

export const kAnnotationFields: readonly AnnotationField[] = [
  'medium', 'alt', 'description', 'tags', 'palette', 'characters', 'looksNude', 'looksChild', 'looksNote',
  'checked', 'role', 'roleGroup', 'roleStar', 'roleNote',
];

// 種類ごとに持つ項目。
export const kAnnotationFieldsByType: Record<EntityType, readonly AnnotationField[]> = {
  image: kAnnotationFields,
  video: kAnnotationFields,
  audio: ['alt', 'description', 'tags'],
};

export namespace Moment {
  export namespace Save {
    export type Request = {
      title: string;
      originalDate: string | null;
      date: string | null;
      author: string;
      text: string;
      status: MomentStatus;
      tier: MomentTier;
      series: string[];
      // null なら本文と注釈から計算した値（自動）。true / false なら手での上書き。
      sensitiveOverride: boolean | null;
    };
    export type Response = {
      path: string;
      date: string;
      status: MomentStatus;
      sensitive: boolean;
      sensitiveManual: boolean;
      body: string;
    };
  }
  export namespace Search {
    export type Response = {
      angle: number;
      date: string;
      title: string;
      path: string;
      imageURL: string;
      bodyURL: string;
    };
  }
  export namespace Delete {
    export type Request = {
      date: string;
    };
    export type Response = {
      year: string;
    };
  }
}
