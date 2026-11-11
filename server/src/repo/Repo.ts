import dayjs from 'dayjs';
import NodeCache from 'node-cache';
import pg from 'pg';

import Pool, { Queryable } from './Pool.js';
import { Entity, EntityLocation, ExternalVideoRef } from '../shelf/Entity.js';
import { parseExternalVideoRef } from '../lib/ExternalVideoRef.js';
import {
  EntityAnnotation,
  parseAnnotationMethods,
  parseAnnotationPalette,
} from '../shelf/EntityAnnotation.js';
import Config from '../Config.js';
import {
  Moment,
  MomentSummary,
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
  "duration",
  "location",
  "external_ref"
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
  "duration",
  "location",
  "external_ref"
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
  "id", "medium_id", "icon_id", "timestamp", "type", "mime_type", "width", "height", "duration", "location", "external_ref"
) values (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
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
          'internal',
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
          encodeMimeType(entity),
          entity.width,
          entity.height,
          entity.duration,
          entity.location,
          encodeExternalRef(entity),
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
          'internal',
          null,
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
          encodeMimeType(entity),
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

  // Moment の値をそのまま書く。
  async insertMoment(moment: Moment) {
    if (moment.timestamp === undefined) {
      throw new Error('[FIXME] No timestamp!')
    }
    // language=PostgreSQL
    const q = `
insert into moments(
  "timestamp", "title", "author", "text", "icon_id", "status",
  "tier", "series", "intent"
) values (
  $1, $2, $3, $4, $5, $6, $7, $8::text[], $9
);`;
    await this.pool.query(q, [
      moment.timestamp.toDate(),
      moment.title,
      moment.author,
      moment.text,
      moment.iconID === undefined ? null : moment.iconID,
      moment.status,
      moment.tier,
      moment.series,
      moment.intent,
    ]);
  }

  // Moment の値をそのまま書く。oldTimestamp の moment が無ければ false。
  async updateMoment(oldTimestamp: dayjs.Dayjs, moment: Moment): Promise<boolean> {
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
  "tier" = $8,
  "series" = $9::text[],
  "intent" = $10
where "timestamp" = $7;
`;
    const r = await this.pool.query(q, [
      moment.timestamp.toDate(),
      moment.title,
      moment.author,
      moment.text,
      moment.iconID === undefined ? null : moment.iconID,
      moment.status,
      oldTimestamp.toDate(),
      moment.tier,
      moment.series,
      moment.intent,
    ]);
    return r.rowCount === 1;
  }

  // ura の一覧用。visibility で見える全件を、本文も含めて新しい順に返す。
  async findAllMoments(visibility: MomentVisibility): Promise<Moment[]> {
    // language=PostgreSQL
    const q=`
select ${kMomentColumns}
from moments
  where
    ${momentVisibilityCondition(visibility)}
order by timestamp desc;
`;
    const { rows } = await this.pool.query(q, []);
    return rows.map(decodeMoment);
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

  async findMoment(timestamp: dayjs.Dayjs, visibility: MomentVisibility): Promise<Moment | null> {
    // language=PostgreSQL
    const q=`
select ${kMomentColumns}
from moments
  where
    "timestamp" = $1
    and ${momentVisibilityCondition(visibility)};
`;
    const { rows } = await this.pool.query(q, [timestamp.toDate()]);
    for (const row of rows) {
      return decodeMoment(row);
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
  async* enumurateAllMoments(): AsyncGenerator<Moment> {
    // language=PostgreSQL
    const q=`
select ${kMomentColumns}
from moments
`;
    const { rows } = await this.pool.query(q, []);
    for (const row of rows) {
      yield decodeMoment(row);
    }
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
  "entity_id", "methods"::text[] as "methods", "materials", "subject", "alt", "description", "tags", "palette", "characters",
  "note", "human_verified"
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
  "entity_id", "methods", "materials", "subject", "alt", "description", "tags", "palette", "characters",
  "note", "human_verified"
) values (
  $1, $2::annotation_method[], $3::text[], $4, $5, $6, $7::text[], $8, $9::text[], $10, $11
) on conflict ("entity_id") do update set
  "methods" = excluded."methods",
  "materials" = excluded."materials",
  "subject" = excluded."subject",
  "alt" = excluded."alt",
  "description" = excluded."description",
  "tags" = excluded."tags",
  "palette" = excluded."palette",
  "characters" = excluded."characters",
  "note" = excluded."note",
  "human_verified" = excluded."human_verified";
`;
    await this.pool.query(q, [
      a.entityID,
      a.methods,
      a.materials,
      a.subject,
      a.alt,
      a.description,
      a.tags,
      a.palette,
      a.characters,
      a.note,
      a.humanVerified,
    ]);
  }
}

// decodeMoment が読む列。moment を丸ごと読むクエリはすべてこれを使う（列を読み落とすと、読んだ moment を書き戻したときにその値が消える）。
const kMomentColumns = `"timestamp", "title", "author", "text", "icon_id", "status", "tier", "series", "intent"`;

function decodeMoment(row: pg.QueryResultRow): Moment {
  return {
    timestamp: dayjs(row['timestamp'] as Date),
    title: row['title'] as string || '',
    author: row['author'] as string || '',
    text: row['text'] as string || '',
    iconID: row['icon_id'] as (string | null) || undefined,
    status: parseMomentStatus(row['status']),
    tier: parseMomentTier(row['tier']),
    series: row['series'] as string[],
    intent: row['intent'] as (string | null),
  };
}

function decodeEntityAnnotation(row: pg.QueryResultRow): EntityAnnotation {
  return {
    entityID: row['entity_id'] as string,
    // ENUM の配列は pg が配列にしないので、select で text[] にしてから読む。
    methods: parseAnnotationMethods(row['methods']),
    materials: row['materials'] as (string[] | null),
    subject: row['subject'] as (string | null),
    alt: row['alt'] as (string | null),
    description: row['description'] as (string | null),
    tags: row['tags'] as (string[] | null),
    palette: parseAnnotationPalette(row['palette']),
    characters: row['characters'] as (string[] | null),
    note: row['note'] as (string | null),
    humanVerified: row['human_verified'] as boolean,
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

// mime_type 列の値。internal は元ファイルの種類、external は元ファイルが無いので NULL。
function encodeMimeType(entity: Entity): string | null {
  switch (entity.location) {
    case 'internal':
      return entity.mimeType;
    case 'external':
      return null;
  }
}

// external_ref 列（jsonb）の値。配列でない値は JSON の文字列にして渡す。internal は NULL。
function encodeExternalRef(entity: Entity): string | null {
  switch (entity.location) {
    case 'internal':
      return null;
    case 'external':
      return JSON.stringify(entity.externalRef);
  }
}

// external_ref（jsonb）を platform で振り分けて、platform ごとに中身を検証する。未知の platform・不正な中身なら例外を投げる。
function decodeExternalVideoRef(id: string, value: unknown): ExternalVideoRef {
  try {
    return parseExternalVideoRef(value);
  } catch (e) {
    throw new Error(`Entity ${id}: invalid external_ref: ${(e as Error).message}`);
  }
}

// location を読む。external になれるのは video だけ（DB の CHECK と同じ）。外れた行なら例外を投げる。
function decodeLocation(row: pg.QueryResultRow): EntityLocation {
  const location = row['location'];
  if (location !== 'internal' && location !== 'external') {
    throw new Error(`Entity ${row['id']}: invalid location: ${location}`);
  }
  if (location === 'external' && row['type'] !== 'video') {
    throw new Error(`Entity ${row['id']}: only a video can be external (type: ${row['type']})`);
  }
  return location;
}

// internal の mime_type（元ファイルの種類）。internal なら必ずある（DB の CHECK と同じ）。無い行なら例外を投げる。
function decodeMimeType(row: pg.QueryResultRow): string {
  const mimeType = row['mime_type'];
  if (typeof mimeType !== 'string') {
    throw new Error(`Entity ${row['id']}: an internal entity must have mime_type`);
  }
  return mimeType;
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
  const location = decodeLocation(row);
  switch (type) {
    case 'image':
      return {
        type: 'image',
        location: 'internal',
        id: row['id'] as string,
        mediumID: row['medium_id'] as string,
        iconID: row['icon_id'] as string,
        timestamp: timestamp,
        mimeType: decodeMimeType(row),
        width: row['width'] as number,
        height: row['height'] as number,
      };
    case 'video': {
      const video = {
        type: 'video' as const,
        id: row['id'] as string,
        iconID: row['icon_id'] as string,
        timestamp: timestamp,
        width: row['width'] as number,
        height: row['height'] as number,
        duration: row['duration'] as number,
      };
      switch (location) {
        case 'internal':
          return { ...video, location: 'internal', mimeType: decodeMimeType(row) };
        case 'external':
          return { ...video, location: 'external', externalRef: decodeExternalVideoRef(video.id, row['external_ref']) };
      }
    }
    case 'audio':
      return {
        type: 'audio',
        location: 'internal',
        id: row['id'] as string,
        iconID: row['icon_id'] as string,
        timestamp: timestamp,
        mimeType: decodeMimeType(row),
        duration: row['duration'] as number,
      };
    default:
      throw new Error(`[FIXME] Unreachable code! (Unknown entity type: ${type})`);
  }
}
