import Pool from './Pool';
import {Entity} from '../shelf/Entity';
import dayjs from 'dayjs';
import Config from '../Config';
import Moment from '../shelf/Moment';

export default class Repo {
  readonly pool: Pool;
  constructor() {
    this.pool = new Pool(Config.dbHostname);
  }
  async findEntity(id: string): Promise<Entity | null> {
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
    switch (type) {
      case 'image':
        return {
          type: 'image',
          id: row.get('id') as string,
          mediumID: row.get('medium_id') as string,
          iconID: row.get('icon_id') as string,
          timestamp: timestamp,
          mimeType: row.get('mime_type') as string,
          width: row.get('width') as number,
          height: row.get('height') as number,
        };
      case 'video':
        return {
          type: 'video',
          id: row.get('id') as string,
          iconID: row.get('icon_id') as string,
          timestamp: timestamp,
          mimeType: row.get('mime_type') as string,
          width: row.get('width') as number,
          height: row.get('height') as number,
          duration: row.get('duration') as number,
        };
      case 'audio':
        return {
          type: 'audio',
          id: row.get('id') as string,
          iconID: row.get('icon_id') as string,
          timestamp: timestamp,
          mimeType: row.get('mime_type') as string,
          duration: row.get('duration') as number,
        };
      default:
        throw new Error(`Unknown type: ${type}`)
    }
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
  }
  async registerMoment(moment: Moment) {
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
}
