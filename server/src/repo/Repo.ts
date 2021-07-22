import Pool from './Pool';
import {Entity} from '../shelf/Entity';
import dayjs from 'dayjs';
import Config from '../Config';

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
    const row = await this.pool.query(q1, [id]).then((it) => it.first());
    if (row === undefined) {
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
    // language=PostgreSQL

    let timestamp: Date | null;
    if (entity.timestamp !== undefined) {
      timestamp = entity.timestamp.toDate();
    } else {
      timestamp = null;
    }
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
}
