import Pool from './Pool';
import {Entity, ImageEntity, VideoEntity, AudioEntity} from '../shelf/Entity';
import dayjs from "dayjs";
import {Video} from "lib/dist/fml";

export default class Repo {
  readonly pool: Pool;
  constructor() {
    this.pool = new Pool('postgres');
  }
  async findEntity(id: string): Promise<Entity[]> {
    const results: Entity[] = [];
    // language=PostgreSQL
    const q1 = `
select
  "path",
  "timestamp",
  "type",
  "path",
  "mime_type",
  "width",
  "height",
  "duration"
from entities
  where id = $1
`;
    const result = await this.pool.query(q1, [id]);
    for await (const row of result) {
      const type = row.get('type');
      switch (type) {
        case 'image':
          const image: ImageEntity = {
            id: row.get('id') as string,
            timestamp: dayjs(row.get('timestamp') as Date),
            mimeType: row.get('mime_type') as string,
            type: 'image',
            width: row.get('width') as number,
            height: row.get('height') as number,
          };
          results.push(image);
          break;
        case 'video':
          const video: VideoEntity = {
            id: row.get('id') as string,
            timestamp: dayjs(row.get('timestamp') as Date),
            mimeType: row.get('mime_type') as string,
            type: 'video',
            width: row.get('width') as number,
            height: row.get('height') as number,
            duration: row.get('duration') as number,
          };
          results.push(video);
          break;
        case 'audio':
          const audio: AudioEntity = {
            id: row.get('id') as string,
            timestamp: dayjs(row.get('timestamp') as Date),
            mimeType: row.get('mime_type') as string,
            type: 'audio',
            duration: row.get('duration') as number,
          };
          results.push(audio);
          break;
        default:
          throw new Error(`Unknown type: ${type}`)
      }
    }
    return results;
  }
}
