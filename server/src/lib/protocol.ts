
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
  humanVerified: boolean;
  role: AnnotationRole | null;
  roleGroup: string | null;
  roleStar: boolean | null;
  roleNote: string | null;
};

export type AnnotationField = keyof AnnotationValues;

export const kAnnotationFields: readonly AnnotationField[] = [
  'medium', 'alt', 'description', 'tags', 'palette', 'characters', 'looksNude', 'looksChild', 'looksNote',
  'humanVerified', 'role', 'roleGroup', 'roleStar', 'roleNote',
];

// 種類ごとに持つ項目。
export const kAnnotationFieldsByType: Record<EntityType, readonly AnnotationField[]> = {
  image: kAnnotationFields,
  video: kAnnotationFields,
  audio: ['alt', 'description', 'tags'],
};

// 注釈の行が無い entity の値。列の既定値（humanVerified は false、ほかは null）。呼ぶたびに新しいオブジェクトを返す。
export function emptyAnnotationValues(): AnnotationValues {
  return {
    medium: null, alt: null, description: null, tags: null, palette: null, characters: null,
    looksNude: null, looksChild: null, looksNote: null, humanVerified: false,
    role: null, roleGroup: null, roleStar: null, roleNote: null,
  };
}

// 注釈がどこまで入ったか。ura の編集画面の注釈の印と、一覧の絞り込みで同じ判定を使う。
// unentered: その種類が持つ項目がすべて null（human_verified は false）。注釈の行が無い entity もこれ。
// unverified / verified: 何か入っていて、human_verified が false / true。human_verified を持つ種類（画像・動画）だけ。
// entered: 何か入っている。human_verified を持たない種類（音声）だけ。
export type AnnotationState = 'unentered' | 'unverified' | 'verified' | 'entered';

export function annotationState(type: EntityType, a: AnnotationValues): AnnotationState {
  const fields = kAnnotationFieldsByType[type];
  if (fields.every((f) => f === 'humanVerified' ? !a.humanVerified : a[f] === null)) {
    return 'unentered';
  }
  if (!fields.includes('humanVerified')) {
    return 'entered';
  }
  return a.humanVerified ? 'verified' : 'unverified';
}

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
  export namespace List {
    // ura の一覧（/moments/）に埋め込む、moment 1つ分の要約。下書きも含めた全件を新しい順に渡し、ブラウザで絞り込む。
    // bodyText は検索に使う本文の文章（text ブロックと [link] の text）で、fml の記法は含まない。
    // media は本文の [image]・[video]・[audio] の entity の数（同じ entity は1回）。
    // unentered・unverified はそのうち annotationState が 'unentered'・'unverified' のものの数。
    export type Item = {
      path: string;
      date: string;
      title: string;
      author: string;
      bodyText: string;
      iconID: string | null;
      status: MomentStatus;
      tier: MomentTier;
      series: string[];
      sensitive: boolean;
      sensitiveManual: boolean;
      media: number;
      unentered: number;
      unverified: number;
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

export namespace Annotation {
  export namespace Find {
    // GET /annotations?ids=<id>,<id>,… の応答。entity が無い id は entities に入らない。
    // 注釈の行が無い entity は、未入力の値（humanVerified は false、ほかは null）で返す。
    export type Response = {
      entities: {
        entityID: string;
        type: EntityType;
        annotation: AnnotationValues;
      }[];
    };
  }
  export namespace Save {
    // POST /annotation。annotation の項目はすべて送る（その種類が持たない項目は null、humanVerified は false）。
    export type Request = {
      entityID: string;
      // 開いている moment の日時（Moment.Save.Request の originalDate と同じ形）。新規の moment なら null。
      originalDate?: string | null;
      annotation: AnnotationValues;
    };
    export type Response = {
      // originalDate の moment の、保存のあとの値。moment が無ければ入らない。
      moment?: {
        sensitive: boolean;
        sensitiveManual: boolean;
      };
    };
  }
}
