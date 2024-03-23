import dayjs from 'dayjs';
import NodeCache from 'node-cache';
import { ResultRecord } from 'ts-postgres';

import Pool from './Pool.js';
import { Entity } from '../shelf/Entity.js';
import Config from '../Config.js';
import { Moment, MomentSummary } from '../shelf/Moment.js';

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

 async* enumurateAllEntries(): AsyncGenerator<Entity> {
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
  "timestamp", "title", "author", "text", "icon_id"
) values (
  $1, $2, $3, $4, $5
);`;
    await this.pool.query(q, [
      moment.timestamp.toDate(),
      moment.title,
      moment.author,
      moment.text,
      moment.iconID === undefined ? null : moment.iconID,
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
  "icon_id" = $5
where "timestamp" = $6;
`;
    await this.pool.query(q, [
      moment.timestamp.toDate(),
      moment.title,
      moment.author,
      moment.text,
      moment.iconID === undefined ? null : moment.iconID,
      oldTimestamp.toDate(),
    ]);
  }

  async findMomentSummariesInYear(year: number): Promise<MomentSummary[]> {
    // language=PostgreSQL
    const q=`
select
  "timestamp", "title", "icon_id"
from moments
  where
    '${year}-01-01' <= "timestamp" and "timestamp" < '${year+1}-01-01'
order by timestamp desc;
`;
    const moments: MomentSummary[] = [];
    const rows = await this.pool.query(q, []);
    for await (const row of rows) {
      moments.push(decodeMomentSummary(row));
    }
    return moments;
  }

  async findMomentSummariesByRandom(size: number): Promise<MomentSummary[]> {
    // https://stackoverflow.com/a/41337788
    // language=PostgreSQL
    const q=`
select
  "timestamp", "title", "icon_id"
from moments
  TABLESAMPLE SYSTEM_ROWS($1);
`;
    const moments: MomentSummary[] = [];
    const rows = await this.pool.query(q, [size]);
    for await (const row of rows) {
      moments.push(decodeMomentSummary(row));
    }
    return moments;
  }

  async findMoment(timestamp: dayjs.Dayjs): Promise<Moment | null> {
    // language=PostgreSQL
    const q=`
select
  "timestamp", "title", "author", "text", "icon_id"
from moments
  where
    "timestamp" = $1;
`;
    const rows = await this.pool.query(q, [timestamp.toDate()]);
    for await (const row of rows) {
      return decodeMoment(row);
    }
    return null;
  }

  async* enumurateAllMoments(): AsyncGenerator<Moment> {
    // language=PostgreSQL
    const q=`
select
  "timestamp", "title", "author", "text", "icon_id"
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
  };
}

function decodeMomentSummary(row: ResultRecord): MomentSummary {
  return {
    timestamp: dayjs(row['timestamp'] as Date),
    title: row['title'] as string || '',
    iconID: row['icon_id'] as (string | null) || undefined,
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
