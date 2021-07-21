import Pool from './Pool';
import {Entity} from '../shelf/Entity';
import dayjs from 'dayjs';

export default class Repo {
  readonly pool: Pool;
  constructor() {
    this.pool = new Pool('postgres');
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
    switch (type) {
      case 'image':
        return {
          type: 'image',
          id: row.get('id') as string,
          mediumID: row.get('medium_id') as string,
          iconID: row.get('icon_id') as string,
          timestamp: dayjs(row.get('timestamp') as Date),
          mimeType: row.get('mime_type') as string,
          width: row.get('width') as number,
          height: row.get('height') as number,
        };
      case 'video':
        return {
          type: 'video',
          id: row.get('id') as string,
          iconID: row.get('icon_id') as string,
          timestamp: dayjs(row.get('timestamp') as Date),
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
          timestamp: dayjs(row.get('timestamp') as Date),
          mimeType: row.get('mime_type') as string,
          duration: row.get('duration') as number,
        };
      default:
        throw new Error(`Unknown type: ${type}`)
    }
  }
}
