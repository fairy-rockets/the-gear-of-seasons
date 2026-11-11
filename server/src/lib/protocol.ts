
// draft は ura でだけ見える。omote に出るのは published だけ。
export type MomentStatus = 'draft' | 'published';

export type MomentTier = 'favorite' | 'normal' | 'rough';

export type EntityType = 'image' | 'video' | 'audio';

// メディア（entity）ごとの注釈の、選べる値。null は「値なし」（未入力）で、'none' とは別の値として扱う。
// 項目の意味は #2 のコメント（issuecomment-3603）の「1. DB に足すもの」の表と #95。
// methods（どうやって作ったか）は順序のない集合。draw は手描き（アナログ・デジタル、スライドで描いた図も含む）、
// capture はカメラやマイクで現実を写し取ったもの、render は 3DCG、generate は生成モデル、compose は作曲・演奏。
// 集合は空にせず、重複させず、この順に並べて持つ（EntityAnnotation.ts の parseAnnotationMethods）。
export const kAnnotationMethods = ['draw', 'capture', 'render', 'generate', 'compose'] as const;
export const kAnnotationPalettes = ['color', 'monochrome'] as const;

// materials（使った画材）は値を決めていないので、どんな文字列でも入る。これは注釈の引き出しに出す、よく使う画材の候補（#80）。
// digital はソフトを問わずデジタルで描いたもの。
export const kMaterialSuggestions = ['digital', 'pencil', 'colored_pencil', 'pastel', 'watercolor'] as const;

export type AnnotationMethod = typeof kAnnotationMethods[number];
export type AnnotationPalette = typeof kAnnotationPalettes[number];

// 注釈の項目。entity_annotations の1行から entity_id を除いたもの。
// null は「値なし」（未入力）で、空の文字列・空のリストとは別の値として扱う。
// subject（何が主題か）・note（補足）・description の順に詳しくなる。
// humanVerified は、自動での下書きの有無とは関係なく、その種類が持つ項目をすべて人が入力し、確かめたか（#94・#95）。
export type AnnotationValues = {
  methods: AnnotationMethod[] | null;
  materials: string[] | null;
  subject: string | null;
  alt: string | null;
  description: string | null;
  tags: string[] | null;
  palette: AnnotationPalette | null;
  characters: string[] | null;
  note: string | null;
  humanVerified: boolean;
};

export type AnnotationField = keyof AnnotationValues;

// 項目の並び。注釈の引き出しとエクスポートの hexe.yaml はこの順に出す。
export const kAnnotationFields: readonly AnnotationField[] = [
  'methods', 'materials', 'subject', 'alt', 'description', 'tags', 'palette', 'characters', 'note', 'humanVerified',
];

// 種類ごとに持つ項目。
export const kAnnotationFieldsByType: Record<EntityType, readonly AnnotationField[]> = {
  image: kAnnotationFields,
  video: kAnnotationFields,
  audio: ['methods', 'subject', 'alt', 'description', 'tags', 'note', 'humanVerified'],
};

// materials を書けるのは、methods に draw を含むときだけ（描いたものの画材）。
export function canHaveMaterials(methods: readonly AnnotationMethod[] | null): boolean {
  return methods !== null && methods.includes('draw');
}

// 注釈の行が無い entity の値。列の既定値（humanVerified は false、ほかは null）。呼ぶたびに新しいオブジェクトを返す。
export function emptyAnnotationValues(): AnnotationValues {
  return {
    methods: null, materials: null, subject: null, alt: null, description: null, tags: null, palette: null,
    characters: null, note: null,
    humanVerified: false,
  };
}

// 注釈がどこまで入ったか。ura の編集画面の注釈の印と、一覧の絞り込みで同じ判定を使う。
// unentered: その種類が持つ項目がすべて null（human_verified は false）。注釈の行が無い entity もこれ。
// unverified / verified: 何か入っていて、human_verified が false / true。
export type AnnotationState = 'unentered' | 'unverified' | 'verified';

export function annotationState(type: EntityType, a: AnnotationValues): AnnotationState {
  const fields = kAnnotationFieldsByType[type];
  if (fields.every((f) => f === 'humanVerified' ? !a.humanVerified : a[f] === null)) {
    return 'unentered';
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
      // ねらい・解釈・振り返り。null は未入力。省略はできない（古いタブからの保存で、黙って null にしないため）。
      intent: string | null;
    };
    export type Response = {
      path: string;
      date: string;
      status: MomentStatus;
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
    // media は本文の [image]・[video]・[audio] の entity の数（同じ entity は1回）。mediaByType はその型ごとの内訳で、
    // 型は entity が最初に出てくるブロックの型。
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
      media: number;
      mediaByType: Record<EntityType, number>;
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
    // POST /annotation。annotation の項目はすべて送る（その種類が持たない項目は null）。
    // 応答は本文なしの 204。
    export type Request = {
      entityID: string;
      annotation: AnnotationValues;
    };
  }
}
