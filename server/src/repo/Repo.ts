import dayjs from 'dayjs';
import NodeCache from 'node-cache';
import pg from 'pg';

import Pool, { Queryable } from './Pool.js';
import { Entity } from '../shelf/Entity.js';
import {
  EntityAnnotation,
  parseAnnotationMedium,
  parseAnnotationPalette,
  parseAnnotationRole,
  parseLooksChild,
  parseLooksNude,
} from '../shelf/EntityAnnotation.js';
import Config from '../Config.js';
import {
  CuratedMoment,
  Moment,
  MomentSummary,
  MomentTier,
  MomentVisibility,
  parseMomentStatus,
  parseMomentTier,
} from '../shelf/Moment.js';

/**
 * moments を引くクエリの WHERE に足す条件。
 * 'published' なら公開済みだけ、'all' なら下書きも含めた全件。
 * 引数は MomentVisibility 型の固定値だけなので、文字列に埋め込んでも注入にはならない。
 */
export function momentVisibilityCondition(visibility: MomentVisibility): string {
  switch (visibility) {
    case 'published':
      return `"status" = 'published'`;
    case 'all':
      return 'true';
  }
}

export default class Repo {
  private readonly pool: Queryable;
  private readonly cache: {
    entity: NodeCache,
  };
  // 引数はトランザクション用（transaction() が渡す）。ふだんは引数なしで作る。
  constructor(pool?: Queryable, cache?: { entity: NodeCache }) {
    this.pool = pool ?? new Pool(Config.dbHostname);
    this.cache = cache ?? {
      entity: new NodeCache({
        maxKeys: 8192,
      }),
    };
  }


  async close(): Promise<void> {
    await this.pool.close();
  }

  // fn の中で tx に対して行う読み書きを、1つの接続の上の1つのトランザクションにまとめる。
  // fn が投げたら ROLLBACK する。トランザクションの中の Repo（tx）で呼んだときは、外のトランザクションに加わる。
  async transaction<T>(fn: (tx: Repo) => Promise<T>): Promise<T> {
    return await this.pool.transaction((q) => fn(new Repo(q, this.cache)));
  }

 async* enumurateAllEntities(): AsyncGenerator<Entity> {
       // language=PostgreSQL
    const q1 = `
select
  "id",
  "medium_id",
  "icon_id",
  "timestamp",
  "type",
  "mime_type",
  "width",
  "height",
  "duration"
from entities
`;
    const { rows } = await this.pool.query(q1, []);
    for (const row of rows) {
      yield decodeEntity(row);
    }
 }

  async findEntity(id: string): Promise<Entity | null> {
    {
      const entry = this.cache.entity.get<Entity>(id);
      if (entry !== undefined) {
        return entry;
      }
    }
    // language=PostgreSQL
    const q1 = `
select
  "id",
  "medium_id",
  "icon_id",
  "timestamp",
  "type",
  "mime_type",
  "width",
  "height",
  "duration"
from entities
  where id = $1
`;
    const { rows } = await this.pool.query(q1, [id]);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    const entity = decodeEntity(row);
    this.cache.entity.set(id, entity);
    return entity;
  }

  async insertEntity(entity: Entity) {
    let timestamp: Date | null;
    if (entity.timestamp !== undefined) {
      timestamp = entity.timestamp.toDate();
    } else {
      timestamp = null;
    }
    // language=PostgreSQL
    const q = `
insert into entities (
  "id", "medium_id", "icon_id", "timestamp", "type", "mime_type", "width", "height", "duration"
) values (
  $1, $2, $3, $4, $5, $6, $7, $8, $9
) ON CONFLICT DO NOTHING;
`;
    switch (entity.type) {
      case 'image': {
        await this.pool.query(q, [
          entity.id,
          entity.mediumID,
          entity.iconID,
          timestamp,
          'image',
          entity.mimeType,
          entity.width,
          entity.height,
          null,
        ]);
        break;
      }
      case 'video':
        await this.pool.query(q, [
          entity.id,
          null,
          entity.iconID,
          timestamp,
          'video',
          entity.mimeType,
          entity.width,
          entity.height,
          entity.duration,
        ]);
        break;
      case 'audio':
        await this.pool.query(q, [
          entity.id,
          null,
          entity.iconID,
          timestamp,
          'audio',
          entity.mimeType,
          null,
          null,
          entity.duration,
        ]);
        break;
      default:
        throw new Error('[FIXME] Unreachable code!');
    }
    this.cache.entity.set(entity.id, entity);
  }
  async deleteEntity(entity: Entity) {
    this.cache.entity.del(entity.id);
    // language=PostgreSQL
    const q = `
delete from entities where "id" = $1;
`;
    await this.pool.query(q, [
      entity.id,
    ]);
    this.cache.entity.del(entity.id);
  }
  async updateEntity(entity: Entity) {
    this.cache.entity.del(entity.id);
    // language=PostgreSQL
    const q = `
update entities set
  "medium_id" = $2,
  "icon_id" = $3,
  "mime_type" = $4,
  "width" = $5,
  "height" = $6,
  "duration" = $7
where
  "id" = $1
`;
    let r;
    switch (entity.type) {
      case 'image': {
        r = await this.pool.query(q, [
          entity.id,
          entity.mediumID,
          entity.iconID,
          entity.mimeType,
          entity.width,
          entity.height,
          null,
        ]);
        break;
      }
      case 'video':
        r = await this.pool.query(q, [
          entity.id,
          null,
          entity.iconID,
          entity.mimeType,
          entity.width,
          entity.height,
          entity.duration,
        ]);
        break;
      case 'audio':
        r = await this.pool.query(q, [
          entity.id,
          null,
          entity.iconID,
          entity.mimeType,
          null,
          null,
          entity.duration,
        ]);
        break;
      default:
        throw new Error('[FIXME] Unreachable code!');
    }
    this.cache.entity.set(entity.id, entity);
  }

  // TODO: insertMoment・updateMoment の autoSensitive 引数と、updateMoment の case when は、今の SAVE が
  // sensitive の上書き状態を送ってこないためにある。編集画面から全部送るようになったら、sensitive の値は Shelf が
  // 決めて Moment に入れ、ここでは Moment の値をそのまま書くだけにする（#46）。

  // autoSensitive は本文から計算した sensitive の値。tier・series は DB の既定値（archive・空）になる。
  async insertMoment(moment: Moment, autoSensitive: boolean) {
    if (moment.timestamp === undefined) {
      throw new Error('[FIXME] No timestamp!')
    }
    // language=PostgreSQL
    const q = `
insert into moments(
  "timestamp", "title", "author", "text", "icon_id", "status", "sensitive"
) values (
  $1, $2, $3, $4, $5, $6, $7
);`;
    await this.pool.query(q, [
      moment.timestamp.toDate(),
      moment.title,
      moment.author,
      moment.text,
      moment.iconID === undefined ? null : moment.iconID,
      moment.status,
      autoSensitive,
    ]);
  }

  // ura の SAVE が使う。キュレーションの項目（tier・series・sensitive_manual）は書き換えない。
  // sensitive は、sensitive_manual = false のときだけ autoSensitive（本文から計算した値）にする。
  async updateMoment(oldTimestamp: dayjs.Dayjs, moment: Moment, autoSensitive: boolean) {
    if (moment.timestamp === undefined) {
      throw new Error('[FIXME] No timestamp!')
    }
    // language=PostgreSQL
    const q = `
update moments set
  "timestamp" = $1,
  "title" = $2,
  "author" = $3,
  "text" = $4,
  "icon_id" = $5,
  "status" = $6,
  "sensitive" = case when "sensitive_manual" then "sensitive" else $8::boolean end
where "timestamp" = $7;
`;
    await this.pool.query(q, [
      moment.timestamp.toDate(),
      moment.title,
      moment.author,
      moment.text,
      moment.iconID === undefined ? null : moment.iconID,
      moment.status,
      oldTimestamp.toDate(),
      autoSensitive,
    ]);
  }

  // TODO: updateMomentCuration と updateMomentSensitive は、今の編集画面がキュレーションの項目を送ってこないので
  // updateMoment（SAVE）と分けてある。どれも人間が起こす1つの保存なので、編集画面から全部送るようになったら
  // updateMoment にまとめる。同じ値で UPDATE することがあっても、外に見せるメソッドを少なくする方を取る（#46）。

  // キュレーションの項目のうち tier と series を書く。moment が無ければ false。
  async updateMomentCuration(timestamp: dayjs.Dayjs, tier: MomentTier, series: string[]): Promise<boolean> {
    // language=PostgreSQL
    const q = `
update moments set
  "tier" = $2,
  "series" = $3::text[]
where "timestamp" = $1;
`;
    const r = await this.pool.query(q, [timestamp.toDate(), tier, series]);
    return r.rowCount === 1;
  }

  // sensitive と sensitive_manual をそのまま書く（手での上書きと、その解除）。moment が無ければ false。
  async updateMomentSensitive(timestamp: dayjs.Dayjs, sensitive: boolean, sensitiveManual: boolean): Promise<boolean> {
    // language=PostgreSQL
    const q = `
update moments set
  "sensitive" = $2,
  "sensitive_manual" = $3
where "timestamp" = $1;
`;
    const r = await this.pool.query(q, [timestamp.toDate(), sensitive, sensitiveManual]);
    return r.rowCount === 1;
  }

  // 計算し直した sensitive を書く。sensitive_manual = true の moment と、値が変わらない moment には書かない
  // （書くと updated が動くので）。
  async updateMomentAutoSensitive(timestamp: dayjs.Dayjs, autoSensitive: boolean) {
    // language=PostgreSQL
    const q = `
update moments set
  "sensitive" = $2
where
  "timestamp" = $1
  and not "sensitive_manual"
  and "sensitive" is distinct from $2;
`;
    await this.pool.query(q, [timestamp.toDate(), autoSensitive]);
  }

  async findMomentSummariesInYear(year: number, visibility: MomentVisibility): Promise<MomentSummary[]> {
    // language=PostgreSQL
    const q=`
select
  "timestamp", "title", "icon_id", "status"
from moments
  where
    '${year}-01-01' <= "timestamp" and "timestamp" < '${year+1}-01-01'
    and ${momentVisibilityCondition(visibility)}
order by timestamp desc;
`;
    const moments: MomentSummary[] = [];
    const { rows } = await this.pool.query(q, []);
    for (const row of rows) {
      moments.push(decodeMomentSummary(row));
    }
    return moments;
  }

  // sitemap.xml 用。visibility で見える全件を新しい順に返す。
  async findAllMomentSummaries(visibility: MomentVisibility): Promise<MomentSummary[]> {
    // language=PostgreSQL
    const q=`
select
  "timestamp", "title", "icon_id", "status"
from moments
  where
    ${momentVisibilityCondition(visibility)}
order by timestamp desc;
`;
    const moments: MomentSummary[] = [];
    const { rows } = await this.pool.query(q, []);
    for (const row of rows) {
      moments.push(decodeMomentSummary(row));
    }
    return moments;
  }

  // 抜き出してから visibility で絞るので、返る件数は size を下回ることがある。
  async findMomentSummariesByRandom(size: number, visibility: MomentVisibility): Promise<MomentSummary[]> {
    // https://stackoverflow.com/a/41337788
    // language=PostgreSQL
    const q=`
select
  "timestamp", "title", "icon_id", "status"
from moments
  TABLESAMPLE SYSTEM_ROWS($1)
  where
    ${momentVisibilityCondition(visibility)};
`;
    const moments: MomentSummary[] = [];
    const { rows } = await this.pool.query(q, [size]);
    for (const row of rows) {
      moments.push(decodeMomentSummary(row));
    }
    return moments;
  }

  async findMoment(timestamp: dayjs.Dayjs, visibility: MomentVisibility): Promise<CuratedMoment | null> {
    // language=PostgreSQL
    const q=`
select
  "timestamp", "title", "author", "text", "icon_id", "status",
  "tier", "series", "sensitive", "sensitive_manual"
from moments
  where
    "timestamp" = $1
    and ${momentVisibilityCondition(visibility)};
`;
    const { rows } = await this.pool.query(q, [timestamp.toDate()]);
    for (const row of rows) {
      return decodeCuratedMoment(row);
    }
    return null;
  }

  async findPreviousMomentSummary(timestamp: dayjs.Dayjs, visibility: MomentVisibility): Promise<MomentSummary | null> {
    // language=PostgreSQL
    const q=`
select
  "timestamp", "title", "icon_id", "status"
from moments
  where
    "timestamp" < $1
    and ${momentVisibilityCondition(visibility)}
order by "timestamp" desc
limit 1;
`;
    const { rows } = await this.pool.query(q, [timestamp.toDate()]);
    for (const row of rows) {
      return decodeMomentSummary(row);
    }
    return null;
  }

  async findNextMomentSummary(timestamp: dayjs.Dayjs, visibility: MomentVisibility): Promise<MomentSummary | null> {
    // language=PostgreSQL
    const q=`
select
  "timestamp", "title", "icon_id", "status"
from moments
  where
    "timestamp" > $1
    and ${momentVisibilityCondition(visibility)}
order by "timestamp" asc
limit 1;
`;
    const { rows } = await this.pool.query(q, [timestamp.toDate()]);
    for (const row of rows) {
      return decodeMomentSummary(row);
    }
    return null;
  }

  // 下書きも含めた全件を返す。gc / list-missing / sanity-check がこれで使用中の entity を
  // 数えるので、ここで下書きを落とすと、下書きが使っているメディアが孤児扱いされて消される。
  async* enumurateAllMoments(): AsyncGenerator<CuratedMoment> {
    // language=PostgreSQL
    const q=`
select
  "timestamp", "title", "author", "text", "icon_id", "status",
  "tier", "series", "sensitive", "sensitive_manual"
from moments
`;
    const { rows } = await this.pool.query(q, []);
    for (const row of rows) {
      yield decodeCuratedMoment(row);
    }
  }

  // 本文に entityID を含みうる moment のうち、sensitive_manual = false のもの（注釈を保存したあとに sensitive を計算し直す対象）。
  // 本文を文字列として探すだけなので、返ったものが本当にその entity を使っているかは fml.parse で確かめること。
  // 下書きも計算し直すので、visibility では絞らない。
  async findAutoSensitiveMomentCandidates(entityID: string): Promise<CuratedMoment[]> {
    // language=PostgreSQL
    const q=`
select
  "timestamp", "title", "author", "text", "icon_id", "status",
  "tier", "series", "sensitive", "sensitive_manual"
from moments
  where
    "text" like '%' || $1::text || '%'
    and not "sensitive_manual";
`;
    const moments: CuratedMoment[] = [];
    const { rows } = await this.pool.query(q, [entityID]);
    for (const row of rows) {
      moments.push(decodeCuratedMoment(row));
    }
    return moments;
  }

  async deleteMoment(timestamp: dayjs.Dayjs): Promise<boolean> {
    // language=PostgreSQL
    const q=`
delete from moments where "timestamp" = $1;
`;
    const r = await this.pool.query(q, [timestamp.toDate()]);
    return r.rowCount === 1;
  }

  async findEntityAnnotation(entityID: string): Promise<EntityAnnotation | null> {
    const found = await this.findEntityAnnotations([entityID]);
    return found.get(entityID) ?? null;
  }

  // 注釈の行が無い entity は、返す Map に入らない。
  async findEntityAnnotations(entityIDs: string[]): Promise<Map<string, EntityAnnotation>> {
    const found = new Map<string, EntityAnnotation>();
    if (entityIDs.length === 0) {
      return found;
    }
    // language=PostgreSQL
    const q = `
select
  "entity_id", "medium", "alt", "description", "tags", "palette", "characters",
  "looks_nude", "looks_child", "looks_note", "checked",
  "role", "role_group", "role_star", "role_note"
from entity_annotations
  where "entity_id" = any($1::text[]);
`;
    const { rows } = await this.pool.query(q, [entityIDs]);
    for (const row of rows) {
      const a = decodeEntityAnnotation(row);
      found.set(a.entityID, a);
    }
    return found;
  }

  // すべての項目を annotation の値で置き換える（行が無ければ作る）。
  async upsertEntityAnnotation(a: EntityAnnotation) {
    // language=PostgreSQL
    const q = `
insert into entity_annotations (
  "entity_id", "medium", "alt", "description", "tags", "palette", "characters",
  "looks_nude", "looks_child", "looks_note", "checked",
  "role", "role_group", "role_star", "role_note"
) values (
  $1, $2, $3, $4, $5::text[], $6, $7::text[], $8, $9, $10, $11, $12, $13, $14, $15
) on conflict ("entity_id") do update set
  "medium" = excluded."medium",
  "alt" = excluded."alt",
  "description" = excluded."description",
  "tags" = excluded."tags",
  "palette" = excluded."palette",
  "characters" = excluded."characters",
  "looks_nude" = excluded."looks_nude",
  "looks_child" = excluded."looks_child",
  "looks_note" = excluded."looks_note",
  "checked" = excluded."checked",
  "role" = excluded."role",
  "role_group" = excluded."role_group",
  "role_star" = excluded."role_star",
  "role_note" = excluded."role_note";
`;
    await this.pool.query(q, [
      a.entityID,
      a.medium,
      a.alt,
      a.description,
      a.tags,
      a.palette,
      a.characters,
      a.looksNude,
      a.looksChild,
      a.looksNote,
      a.checked,
      a.role,
      a.roleGroup,
      a.roleStar,
      a.roleNote,
    ]);
  }
}

function decodeMoment(row: pg.QueryResultRow): Moment {
  return {
    timestamp: dayjs(row['timestamp'] as Date),
    title: row['title'] as string || '',
    author: row['author'] as string || '',
    text: row['text'] as string || '',
    iconID: row['icon_id'] as (string | null) || undefined,
    status: parseMomentStatus(row['status']),
  };
}

function decodeCuratedMoment(row: pg.QueryResultRow): CuratedMoment {
  return {
    ...decodeMoment(row),
    tier: parseMomentTier(row['tier']),
    series: row['series'] as string[],
    sensitive: row['sensitive'] as boolean,
    sensitiveManual: row['sensitive_manual'] as boolean,
  };
}

function decodeEntityAnnotation(row: pg.QueryResultRow): EntityAnnotation {
  return {
    entityID: row['entity_id'] as string,
    medium: parseAnnotationMedium(row['medium']),
    alt: row['alt'] as (string | null),
    description: row['description'] as (string | null),
    tags: row['tags'] as (string[] | null),
    palette: parseAnnotationPalette(row['palette']),
    characters: row['characters'] as (string[] | null),
    looksNude: parseLooksNude(row['looks_nude']),
    looksChild: parseLooksChild(row['looks_child']),
    looksNote: row['looks_note'] as (string | null),
    checked: row['checked'] as boolean,
    role: parseAnnotationRole(row['role']),
    roleGroup: row['role_group'] as (string | null),
    roleStar: row['role_star'] as (boolean | null),
    roleNote: row['role_note'] as (string | null),
  };
}

function decodeMomentSummary(row: pg.QueryResultRow): MomentSummary {
  return {
    timestamp: dayjs(row['timestamp'] as Date),
    title: row['title'] as string || '',
    iconID: row['icon_id'] as (string | null) || undefined,
    status: parseMomentStatus(row['status']),
  };
}

function decodeEntity(row: pg.QueryResultRow): Entity {
  const type = row['type'] as string;
  const timestamp = (() => {
    const d = row['timestamp'];
    if (d === undefined || d === null) {
      return undefined;
    } else {
      return dayjs(d as Date);
    }
  })();
  switch (type) {
    case 'image':
      return {
        type: 'image',
        id: row['id'] as string,
        mediumID: row['medium_id'] as string,
        iconID: row['icon_id'] as string,
        timestamp: timestamp,
        mimeType: row['mime_type'] as string,
        width: row['width'] as number,
        height: row['height'] as number,
      };
    case 'video':
      return {
        type: 'video',
        id: row['id'] as string,
        iconID: row['icon_id'] as string,
        timestamp: timestamp,
        mimeType: row['mime_type'] as string,
        width: row['width'] as number,
        height: row['height'] as number,
        duration: row['duration'] as number,
      };
    case 'audio':
      return {
        type: 'audio',
        id: row['id'] as string,
        iconID: row['icon_id'] as string,
        timestamp: timestamp,
        mimeType: row['mime_type'] as string,
        duration: row['duration'] as number,
      };
    default:
      throw new Error(`[FIXME] Unreachable code! (Unknown entity type: ${type})`);
  }
}
