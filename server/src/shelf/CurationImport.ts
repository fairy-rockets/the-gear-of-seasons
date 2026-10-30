import dayjs from 'dayjs';
import { parseDocument } from 'yaml';

import * as fml from '../lib/fml.js';
import Repo from '../repo/Repo.js';
import Shelf from './Shelf.js';
import { Entity } from './Entity.js';
import { AnnotationField, EntityAnnotation, validateEntityAnnotation } from './EntityAnnotation.js';
import { Moment, MomentTier, formatMomentTime, momentIconID, parseMomentTier } from './Moment.js';
import { computeSensitive, sensitiveTargetEntityIDs } from './Sensitive.js';
import {
  AnnotationValue,
  isMomentLabel,
  kMediaKeys,
  kMomentKeys,
  parseBoolean,
  parseEnum,
  parseStrings,
} from './CurationFormat.js';

// DB が正本なので、普段は使わない。値をまとめて書き換えたいときには便利。
// 保守が重くなったら消してよい（cmd/import-curation.ts のほかに、これに依存するものはない）。
//
// studio が書き出した投入用ファイル（#43）を DB に入れる。cmd/import-curation.ts から使う。
// 「読んで検査する」（parseCurationFile）→「DB の今の値と比べて計画を作る」（makeCurationPlan。DB を触らない）
// →「計画を書く」（applyCurationPlan）の3段に分けてある。
// 項目の名前と値は #2 のコメント（issuecomment-3603）の「1. DB に足すもの」、つまりエクスポートの hexe.yaml と同じ（CurationFormat.ts）。

const kEntityFormat = /^[0-9a-f]{32}$/;

export type CurationFileField = {
  key: string;
  field: AnnotationField;
  value: AnnotationValue;
};

export type CurationFileMedia = {
  entityID: string;
  fields: CurationFileField[];
};

export type CurationFileMoment = {
  // ファイルに書かれたままの moment。一覧やエラーに出す。
  label: string;
  timestamp: dayjs.Dayjs;
  tier?: MomentTier;
  series?: string[];
  sensitive?: boolean;
  media: CurationFileMedia[];
};

export type CurationFile = {
  moments: CurationFileMoment[];
};

function isMap(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// 1段目: ファイルを読み、形と値を確かめる。DB は見ない。
// エラーは最初の1つで止めずに全部集める。エラーのあった項目・メディア・moment は返す file から落とす。
export function parseCurationFile(src: string): { file: CurationFile, errors: string[] } {
  const file: CurationFile = { moments: [] };
  const errors: string[] = [];
  // core スキーマなので、moment の 2017-07-26T02:46:00+09:00 は文字列のまま読める。同じキーが2回あればエラーになる。
  const doc = parseDocument(src, { schema: 'core', uniqueKeys: true });
  if (doc.errors.length > 0) {
    return { file, errors: doc.errors.map((err) => err.message) };
  }
  const root: unknown = doc.toJS();
  if (!isMap(root) || !Array.isArray(root['moments'])) {
    return { file, errors: ['moments のリストがありません'] };
  }
  for (const key of Object.keys(root)) {
    if (key !== 'moments') {
      errors.push(`知らないキーです: ${key}`);
    }
  }
  const momentLabels = new Map<number, string>();
  // 注釈は entity ごとなので、同じ entity が別の moment の下にも出てきたら、値がすべて同じときだけ通す。
  const mediaSeen = new Map<string, [string, CurationFileField[]]>();
  root['moments'].forEach((item: unknown, i: number) => {
    let where = `moments[${i}]`;
    if (!isMap(item)) {
      errors.push(`${where}: moment ごとの項目の並びではありません`);
      return;
    }
    const label = item['moment'];
    if (typeof label !== 'string' || !isMomentLabel(label)) {
      errors.push(`${where}: moment がオフセット付きの、存在する時刻（2017-07-26T02:46:00+09:00 の形）ではありません: ${JSON.stringify(label)}`);
      return;
    }
    where = `moment ${label}`;
    const moment: CurationFileMoment = { label, timestamp: dayjs(label), media: [] };
    const dup = momentLabels.get(moment.timestamp.valueOf());
    if (dup !== undefined) {
      errors.push(`${where}: 同じ moment が2回出てきます（${dup}）`);
      return;
    }
    momentLabels.set(moment.timestamp.valueOf(), label);
    for (const [key, v] of Object.entries(item)) {
      if (!kMomentKeys.includes(key)) {
        errors.push(`${where}: 知らないキーです: ${key}`);
        continue;
      }
      if (v === null) {
        errors.push(`${where}: ${key} が null です`);
        continue;
      }
      try {
        switch (key) {
          case 'tier':
            moment.tier = parseEnum(parseMomentTier)(v);
            break;
          case 'series':
            moment.series = parseStrings(v);
            break;
          case 'sensitive':
            moment.sensitive = parseBoolean(v);
            break;
        }
      } catch (err) {
        errors.push(`${where}: ${key}: ${(err as Error).message}`);
      }
    }
    // null は上で media が null のエラーにしてある。
    let media = item['media'] ?? [];
    if (!Array.isArray(media)) {
      errors.push(`${where}: media がリストではありません`);
      media = [];
    }
    const entitiesInMoment = new Set<string>();
    (media as unknown[]).forEach((m: unknown, j: number) => {
      const mwhere = `${where} media[${j}]`;
      if (!isMap(m)) {
        errors.push(`${mwhere}: メディアごとの項目の並びではありません`);
        return;
      }
      const entityID = m['entity'];
      if (typeof entityID !== 'string' || !kEntityFormat.test(entityID)) {
        errors.push(`${mwhere}: entity が md5（小文字の16進数32桁）の文字列ではありません: ${JSON.stringify(entityID)}`);
        return;
      }
      const ewhere = `${where} entity ${entityID}`;
      if (entitiesInMoment.has(entityID)) {
        errors.push(`${ewhere}: 同じ moment の下に同じ entity が2回出てきます`);
        return;
      }
      entitiesInMoment.add(entityID);
      const fields: CurationFileField[] = [];
      for (const [key, v] of Object.entries(m)) {
        if (key === 'entity') {
          continue;
        }
        if (!Object.hasOwn(kMediaKeys, key)) {
          errors.push(`${ewhere}: 知らないキーです: ${key}`);
          continue;
        }
        const def = kMediaKeys[key];
        if (v === null) {
          errors.push(`${ewhere}: ${key} が null です`);
          continue;
        }
        try {
          fields.push({ key, field: def[0], value: def[1](v) });
        } catch (err) {
          errors.push(`${ewhere}: ${key}: ${(err as Error).message}`);
        }
      }
      const seen = mediaSeen.get(entityID);
      const byKey = (fs: CurationFileField[]) => [...fs].sort((a, b) => a.key.localeCompare(b.key));
      if (seen !== undefined && !sameValue(byKey(seen[1]), byKey(fields))) {
        errors.push(`${ewhere}: moment ${seen[0]} の下にも出てきて、値が違います`);
        return;
      }
      mediaSeen.set(entityID, [label, fields]);
      moment.media.push({ entityID, fields });
    });
    file.moments.push(moment);
  });
  return { file, errors };
}

// 2段目に渡す、DB の今の値。loadCurationState が読む。
export type CurationState = {
  // ファイルの moment のうち DB にあったもの。キーはファイルの timestamp の valueOf()。
  moments: Map<number, Moment>;
  // ファイルの entity のうち、entities に行があったもの。
  entities: Map<string, Entity>;
  // ファイルの entity と、ファイルの moment・autoSensitiveMoments の [image]・[video] の entity の注釈（行があるものだけ）。
  annotations: Map<string, EntityAnnotation>;
  // ファイルの entity を本文に含みうる、sensitive_manual = false の moment（ファイルに無い moment も含む）。
  // 注釈を書くと saveEntityAnnotation がこれらの sensitive を計算し直すので、計画にもそれを出す。
  autoSensitiveMoments: Moment[];
};

export async function loadCurationState(repo: Repo, file: CurationFile): Promise<CurationState> {
  const state: CurationState = { moments: new Map(), entities: new Map(), annotations: new Map(), autoSensitiveMoments: [] };
  const entityIDs = new Set<string>();
  for (const m of file.moments) {
    const found = await repo.findMoment(m.timestamp, 'all');
    if (found !== null) {
      state.moments.set(m.timestamp.valueOf(), found);
    }
    for (const media of m.media) {
      entityIDs.add(media.entityID);
    }
  }
  const candidates = new Map<number, Moment>();
  for (const id of entityIDs) {
    const entity = await repo.findEntity(id);
    if (entity !== null) {
      state.entities.set(id, entity);
    }
    for (const m of await repo.findAutoSensitiveMomentCandidates(id)) {
      candidates.set(m.timestamp!!.valueOf(), m);
    }
  }
  state.autoSensitiveMoments = [...candidates.values()];
  const annotationIDs = new Set(entityIDs);
  // ファイルの moment は SAVE と同じ口で書くので、自動なら sensitive が計算し直される。その計算にも要る。
  for (const m of [...state.moments.values(), ...state.autoSensitiveMoments]) {
    for (const id of sensitiveTargetEntityIDs(fml.parse(m.text))) {
      annotationIDs.add(id);
    }
  }
  state.annotations = await repo.findEntityAnnotations([...annotationIDs]);
  return state;
}

export type FieldChange = {
  key: string;
  from: unknown;
  to: unknown;
  // --overwrite で、衝突していた値を上書きするか。
  overwrite: boolean;
  // 一覧に添える説明。
  note?: string;
};

export type Conflict = {
  momentLabel: string;
  // moment の項目なら null。
  entityID: string | null;
  key: string;
  current: unknown;
  file: unknown;
};

export type MomentPlan = {
  label: string;
  timestamp: dayjs.Dayjs;
  changes: FieldChange[];
  // 書いたあとの tier と series。
  tier: MomentTier;
  series: string[];
  // 手で上書きする sensitive の値。書かないなら null。
  sensitive: boolean | null;
};

export type EntityPlan = {
  momentLabel: string;
  entity: Entity;
  changes: FieldChange[];
  // 書く注釈（今の注釈に、ファイルの項目を重ねたもの）。
  annotation: EntityAnnotation;
};

export type AutoSensitivePlan = {
  timestamp: dayjs.Dayjs;
  from: boolean;
  to: boolean;
};

export type CurationPlan = {
  errors: string[];
  // 変更のあるものだけ。
  moments: MomentPlan[];
  entities: EntityPlan[];
  // 注釈を書いたあとや、moment を書くときに計算し直されて変わる sensitive（手で上書きしない moment のもの）。
  autoSensitive: AutoSensitivePlan[];
  conflicts: Conflict[];
};

// 今の値が「未入力」か。既定値（tier = archive・series = []・human_verified = false）も未入力とみなし、衝突にしない。
function isUnset(key: string, v: unknown): boolean {
  switch (key) {
    case 'tier':
      return v === 'archive';
    case 'series':
      return Array.isArray(v) && v.length === 0;
    case 'human_verified':
      return v === false;
    default:
      return v === null;
  }
}

type Decision = 'same' | 'change' | 'conflict' | 'overwrite';

// 値が変わらなければ書かない。今の値が未入力なら書く。今の値があってファイルと違えば衝突で、--overwrite のときだけ書く。
function decide(key: string, current: unknown, next: unknown, overwrite: boolean): Decision {
  if (sameValue(current, next)) {
    return 'same';
  }
  if (isUnset(key, current)) {
    return 'change';
  }
  return overwrite ? 'overwrite' : 'conflict';
}

function emptyAnnotation(entityID: string): EntityAnnotation {
  return {
    entityID, medium: null, alt: null, description: null, tags: null, palette: null, characters: null,
    looksNude: null, looksChild: null, looksNote: null, humanVerified: false,
    role: null, roleGroup: null, roleStar: null, roleNote: null,
  };
}

// 2段目: ファイルと DB の今の値を比べて、書くもの・衝突・エラーを決める。DB は触らない。
// errors が1つでもあれば、何も書かない（applyCurationPlan を呼ばない）。
export function makeCurationPlan(file: CurationFile, state: CurationState, opts: { overwrite: boolean }): CurationPlan {
  const plan: CurationPlan = { errors: [], moments: [], entities: [], autoSensitive: [], conflicts: [] };
  const done = new Set<string>();
  for (const fm of file.moments) {
    const where = `moment ${fm.label}`;
    const current = state.moments.get(fm.timestamp.valueOf());
    if (current === undefined) {
      plan.errors.push(`${where}: DB にありません`);
      continue;
    }
    const conflict = (entityID: string | null, key: string, cur: unknown, next: unknown) => {
      plan.conflicts.push({ momentLabel: fm.label, entityID, key, current: cur, file: next });
    };

    // moment の項目
    const mp: MomentPlan = {
      label: fm.label, timestamp: current.timestamp!!, changes: [],
      tier: current.tier, series: current.series, sensitive: null,
    };
    if (fm.tier !== undefined) {
      const d = decide('tier', current.tier, fm.tier, opts.overwrite);
      if (d === 'conflict') {
        conflict(null, 'tier', current.tier, fm.tier);
      } else if (d !== 'same') {
        mp.changes.push({ key: 'tier', from: current.tier, to: fm.tier, overwrite: d === 'overwrite' });
        mp.tier = fm.tier;
      }
    }
    if (fm.series !== undefined) {
      const d = decide('series', current.series, fm.series, opts.overwrite);
      if (d === 'conflict') {
        conflict(null, 'series', current.series, fm.series);
      } else if (d !== 'same') {
        mp.changes.push({ key: 'series', from: current.series, to: fm.series, overwrite: d === 'overwrite' });
        mp.series = fm.series;
      }
    }
    // sensitive は、手で上書きされていない（sensitive_manual = false）なら未入力とみなす。
    // 値が今と同じでも、sensitive_manual を true にするために書く（2回目は変わらない）。
    if (fm.sensitive !== undefined) {
      if (!current.sensitiveManual) {
        mp.changes.push({ key: 'sensitive', from: current.sensitive, to: fm.sensitive, overwrite: false, note: '自動の値を手での上書きにする' });
        mp.sensitive = fm.sensitive;
      } else if (fm.sensitive !== current.sensitive) {
        if (opts.overwrite) {
          mp.changes.push({ key: 'sensitive', from: current.sensitive, to: fm.sensitive, overwrite: true });
          mp.sensitive = fm.sensitive;
        } else {
          conflict(null, 'sensitive', current.sensitive, fm.sensitive);
        }
      }
    }
    if (mp.changes.length > 0) {
      // SAVE と同じ口で書くので、icon_id は本文から求め直される。変わるなら計画に出す。
      const iconID = momentIconID(fml.parse(current.text));
      if (iconID !== current.iconID) {
        mp.changes.push({ key: 'icon_id', from: current.iconID ?? null, to: iconID ?? null, overwrite: false, note: '本文から求め直す' });
      }
      plan.moments.push(mp);
    }

    // メディアごとの項目
    const doc = fml.parse(current.text);
    const inBody = new Set<string>();
    for (const block of doc.blocks) {
      if ((block.type === 'image' || block.type === 'video' || block.type === 'audio') && block.entity !== undefined) {
        inBody.add(block.entity);
      }
    }
    for (const media of fm.media) {
      const ewhere = `${where} entity ${media.entityID}`;
      if (!inBody.has(media.entityID)) {
        plan.errors.push(`${ewhere}: その moment の本文の [image]・[video]・[audio] にありません`);
        continue;
      }
      const entity = state.entities.get(media.entityID);
      if (entity === undefined) {
        plan.errors.push(`${ewhere}: entities にありません`);
        continue;
      }
      // その種類が持たない項目がファイルにあれば止める。項目ごとに確かめ、合わないものを全部挙げる。
      const rejected = media.fields.filter((f) => {
        const one = emptyAnnotation(entity.id) as Record<AnnotationField, AnnotationValue>;
        one[f.field] = f.value;
        try {
          validateEntityAnnotation(entity, one as EntityAnnotation);
          return false;
        } catch (_err) {
          return true;
        }
      });
      if (rejected.length > 0) {
        plan.errors.push(`${ewhere}: ${entity.type} の entity が持たない項目です: ${rejected.map((f) => f.key).join(', ')}`);
        continue;
      }
      // 同じ entity が別の moment の下にも出てきたとき（値は同じことを parseCurationFile が確かめている）は、1回目だけ見る。
      if (done.has(entity.id)) {
        continue;
      }
      done.add(entity.id);
      const currentAnnotation = state.annotations.get(entity.id) ?? emptyAnnotation(entity.id);
      const next = { ...currentAnnotation } as Record<AnnotationField, AnnotationValue>;
      const changes: FieldChange[] = [];
      for (const f of media.fields) {
        const cur = currentAnnotation[f.field];
        const d = decide(f.key, cur, f.value, opts.overwrite);
        if (d === 'conflict') {
          conflict(entity.id, f.key, cur, f.value);
        } else if (d !== 'same') {
          changes.push({ key: f.key, from: cur, to: f.value, overwrite: d === 'overwrite' });
          next[f.field] = f.value;
        }
      }
      if (changes.length > 0) {
        plan.entities.push({ momentLabel: fm.label, entity, changes, annotation: next as EntityAnnotation });
      }
    }
  }

  // 自動の moment の sensitive が計算し直されるのは、次の2つ。
  // - 注釈を書くと、その entity を [image]・[video] に含む moment（saveEntityAnnotation）。
  // - 書く moment（plan.moments）のうち、手で上書きしないもの（SAVE と同じ口で書くので）。
  //   保存されている値が今の計算と食い違っていれば（Sensitive.ts の規則を変えたあとなど）、注釈を書かなくても変わる。
  // 手で上書きする moment は、そのあとで上書きの値になるので除く。
  const written = new Map(state.annotations);
  for (const e of plan.entities) {
    written.set(e.entity.id, e.annotation);
  }
  const overridden = new Set(plan.moments.filter((m) => m.sensitive !== null).map((m) => m.timestamp.valueOf()));
  const recomputed = new Map<number, Moment>();
  for (const m of state.autoSensitiveMoments) {
    if (sensitiveTargetEntityIDs(fml.parse(m.text)).some((id) => plan.entities.some((e) => e.entity.id === id))) {
      recomputed.set(m.timestamp!!.valueOf(), m);
    }
  }
  for (const mp of plan.moments) {
    const m = state.moments.get(mp.timestamp.valueOf())!!;
    if (!m.sensitiveManual) {
      recomputed.set(m.timestamp!!.valueOf(), m);
    }
  }
  for (const [key, m] of recomputed) {
    if (overridden.has(key)) {
      continue;
    }
    const to = computeSensitive(fml.parse(m.text), written);
    if (to !== m.sensitive) {
      plan.autoSensitive.push({ timestamp: m.timestamp!!, from: m.sensitive, to });
    }
  }
  plan.autoSensitive.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());
  return plan;
}

// 3段目: 計画を書く。1つのトランザクションにするため、shelf は tx で作ったもの（new Shelf(tx)）を渡す。
// 注釈を先に書き（sensitive が計算し直される）、そのあとで moment を書く。
// moment は ura の SAVE と同じ Shelf.updateMoment で書く。今の値を読み直し、計画で変わる項目だけを差し替えて渡す。
export async function applyCurationPlan(shelf: Shelf, plan: CurationPlan) {
  if (plan.errors.length > 0) {
    throw new Error('[FIXME] Cannot apply a plan with errors');
  }
  for (const e of plan.entities) {
    await shelf.saveEntityAnnotation(e.annotation);
  }
  for (const m of plan.moments) {
    const current = await shelf.findMoment(m.timestamp, 'all');
    if (current === null) {
      throw new Error(`Moment not found: ${m.label}`);
    }
    const date = formatMomentTime(current.timestamp!!);
    const changed = (key: string) => m.changes.some((c) => c.key === key);
    // 計画に sensitive が無ければ、今の状態を保つ（手で上書きしてあればその値、そうでなければ自動のまま）。
    const keep = current.sensitiveManual ? current.sensitive : null;
    await shelf.updateMoment({
      title: current.title,
      originalDate: date,
      date: date,
      author: current.author,
      text: current.text,
      status: current.status,
      tier: changed('tier') ? m.tier : current.tier,
      series: changed('series') ? m.series : current.series,
      sensitiveOverride: m.sensitive ?? keep,
    });
  }
}
