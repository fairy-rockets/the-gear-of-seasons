import Pool from './Pool';
import {Entity} from '../shelf/Entity';
import dayjs from 'dayjs';
import Config from '../Config';
import Moment from '../shelf/Moment';
import NodeCache from 'node-cache';
import {ResultRow} from "ts-postgres";

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
    const row = await (async()=>{
      for await (const r of rows) {
        return r;
      }
      return null;
    })();
    if (row === null) {
      return null;
    }
    const type = row.get('type');
    const timestamp = (() => {
      const d = row.get('timestamp');
      if (d === undefined) {
        return undefined;
      } else {
        return dayjs(d as Date);
      }
    })();
    let entity: Entity;
    switch (type) {
      case 'image':
        entity = {
          type: 'image',
          id: row.get('id') as string,
          mediumID: row.get('medium_id') as string,
          iconID: row.get('icon_id') as string,
          timestamp: timestamp,
          mimeType: row.get('mime_type') as string,
          width: row.get('width') as number,
          height: row.get('height') as number,
        };
        break;
      case 'video':
        entity = {
          type: 'video',
          id: row.get('id') as string,
          iconID: row.get('icon_id') as string,
          timestamp: timestamp,
          mimeType: row.get('mime_type') as string,
          width: row.get('width') as number,
          height: row.get('height') as number,
          duration: row.get('duration') as number,
        };
        break;
      case 'audio':
        entity = {
          type: 'audio',
          id: row.get('id') as string,
          iconID: row.get('icon_id') as string,
          timestamp: timestamp,
          mimeType: row.get('mime_type') as string,
          duration: row.get('duration') as number,
        };
        break;
      default:
        throw new Error(`Unknown type: ${type}`)
    }
    this.cache.entity.set(id, entity);
    return entity;
  }

  async registerEntity(entity: Entity) {
    let timestamp: Date | null;
    if (entity.timestamp !== undefined) {
      timestamp = entity.timestamp.toDate();
    } else {
      timestamp = null;
    }
    // language=PostgreSQL
    const q = `
insert into entities
(
"id", "medium_id", "icon_id", "timestamp", "type", "mime_type", "width", "height", "duration"
)
values
($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT DO NOTHING;
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
        throw new Error('[FIXME] Unreachable code!')
    }
    this.cache.entity.set(entity.id, entity);
  }
  async registerMoment(moment: Moment) {
    if (moment.timestamp === undefined) {
      throw new Error('[FIXME] No timestamp!')
    }
    // language=PostgreSQL
    const q = `
insert into moments
("timestamp", "title", "author", "text")
values
($1, $2, $3, $4);
`;
    await this.pool.query(q, [
      moment.timestamp.toDate(),
      moment.title,
      moment.author,
      moment.text,
    ]);
  }
  async replaceMoment(oldTimestamp: dayjs.Dayjs, moment: Moment) {
    if (moment.timestamp === undefined) {
      throw new Error('[FIXME] No timestamp!')
    }
    // language=PostgreSQL
    const q = `
update moments set
  "timestamp" = $1,
  "title" = $2,
  "author" = $3,
  "text" = $4
where "timestamp" = $5;
`;
    await this.pool.query(q, [
      moment.timestamp.toDate(),
      moment.title,
      moment.author,
      moment.text,
      oldTimestamp.toDate(),
    ]);
  }

  async findMomentsInYear(year: number): Promise<Moment[]> {
    // language=PostgreSQL
    const q=`
select timestamp, title, author, text from moments
where
'${year}-01-01' <= timestamp and timestamp < '${year+1}-01-01';
`;
    const moments: Moment[] = [];
    const rows = await this.pool.query(q, []);
    for await (const row of rows) {
      moments.push(decodeMoment(row));
    }
    return moments;
  }
}

function decodeMoment(row: ResultRow): Moment {
  return {
    timestamp: dayjs(row.get('timestamp') as Date),
    title: row.get('title') as string,
    author: row.get('author') as string,
    text: row.get('text') as string,
  };
}