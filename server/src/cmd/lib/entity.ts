import { Entity } from '../../shelf/Entity.js';

// コマンドの出力に出す entity の種類。internal は元ファイルの種類（mime_type）、external は元ファイルが無いので external。
export function entityKind(entity: Entity): string {
  switch (entity.location) {
    case 'internal':
      return entity.mimeType;
    case 'external':
      return 'external';
  }
}
