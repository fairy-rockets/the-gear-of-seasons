import dayjs from 'dayjs';
import NodeCache from 'node-cache';
import { ResultRecord } from 'ts-postgres';

import Pool from './Pool.js';
import { Entity } from '../shelf/Entity.js';
import Config from '../Config.js';
import { Moment, MomentSummary, MomentVisibility, parseMomentStatus } from '../shelf/Moment.js';

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
  private readonly pool: Pool;
  private readonly cache: {
    entity: NodeCache,
  };
  constructor() {
    this.pool = new Pool(Config.dbHostname);
    this.cache = {
      entity: new NodeCache({
        maxKeys: 8192,
      }),
    };
  }


  async close(): Promise<void> {
    await this.pool.close();
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
    const rows = await this.pool.query(q1, []);
    for await (const row of rows) {
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
    const rows = await this.pool.query(q1, [id]);
    if (rows === undefined) {
      return null;
    }
    const row = await (async () => {
      for await (const r of rows) {
        return r;
      }
      return null;
    })();
    if (row === null) {
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

  async insertMoment(moment: Moment) {
    if (moment.timestamp === undefined) {
      throw new Error('[FIXME] No timestamp!')
    }
    // language=PostgreSQL
    const q = `
insert into moments(
  "timestamp", "title", "author", "text", "icon_id", "status"
) values (
  $1, $2, $3, $4, $5, $6
);`;
    await this.pool.query(q, [
      moment.timestamp.toDate(),
      moment.title,
      moment.author,
      moment.text,
      moment.iconID === undefined ? null : moment.iconID,
      moment.status,
    ]);
  }

  async updateMoment(oldTimestamp: dayjs.Dayjs, moment: Moment) {
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
  "status" = $6
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
    ]);
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
    const rows = await this.pool.query(q, []);
    for await (const row of rows) {
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
    const rows = await this.pool.query(q, []);
    for await (const row of rows) {
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
    const rows = await this.pool.query(q, [size]);
    for await (const row of rows) {
      moments.push(decodeMomentSummary(row));
    }
    return moments;
  }

  async findMoment(timestamp: dayjs.Dayjs, visibility: MomentVisibility): Promise<Moment | null> {
    // language=PostgreSQL
    const q=`
select
  "timestamp", "title", "author", "text", "icon_id", "status"
from moments
  where
    "timestamp" = $1
    and ${momentVisibilityCondition(visibility)};
`;
    const rows = await this.pool.query(q, [timestamp.toDate()]);
    for await (const row of rows) {
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
    const rows = await this.pool.query(q, [timestamp.toDate()]);
    for await (const row of rows) {
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
    const rows = await this.pool.query(q, [timestamp.toDate()]);
    for await (const row of rows) {
      return decodeMomentSummary(row);
    }
    return null;
  }

  // 下書きも含めた全件を返す。gc / list-missing / sanity-check がこれで使用中の entity を
  // 数えるので、ここで下書きを落とすと、下書きが使っているメディアが孤児扱いされて消される。
  async* enumurateAllMoments(): AsyncGenerator<Moment> {
    // language=PostgreSQL
    const q=`
select
  "timestamp", "title", "author", "text", "icon_id", "status"
from moments
`;
    const rows = await this.pool.query(q, []);
    for await (const row of rows) {
      yield decodeMoment(row);
    }
  }

  async deleteMoment(timestamp: dayjs.Dayjs): Promise<boolean> {
    // language=PostgreSQL
    const q=`
delete from moments where "timestamp" = $1;
`;
    const r = await this.pool.query(q, [timestamp.toDate()]);
    return r.status?.trim() === 'DELETE 1';
  }
}

function decodeMoment(row: ResultRecord): Moment {
  return {
    timestamp: dayjs(row['timestamp'] as Date),
    title: row['title'] as string || '',
    author: row['author'] as string || '',
    text: row['text'] as string || '',
    iconID: row['icon_id'] as (string | null) || undefined,
    status: parseMomentStatus(row['status']),
  };
}

function decodeMomentSummary(row: ResultRecord): MomentSummary {
  return {
    timestamp: dayjs(row['timestamp'] as Date),
    title: row['title'] as string || '',
    iconID: row['icon_id'] as (string | null) || undefined,
    status: parseMomentStatus(row['status']),
  };
}

function decodeEntity(row: ResultRecord): Entity {
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
