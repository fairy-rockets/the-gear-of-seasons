import dayjs from 'dayjs';

import { ExternalVideo } from '../lib/ExternalVideoFormat.js';

export type { ExternalVideo };

// entity の元の置き場所。DB の location。
// internal は元ファイルを _storage/original に持つ。external はサーバーの外（YouTube など）にあり、icon だけを storage に持つ。
// external になれるのは video だけ（DB の CHECK も同じ）。
export type EntityLocation = 'internal' | 'external';

type EntityBase = {
  readonly id: string;
  readonly iconID: string,
  readonly timestamp: dayjs.Dayjs | undefined,
  readonly location: EntityLocation,
};

// 元ファイルを持つ entity。mimeType は元ファイルの種類（external には元ファイルが無いので持たない）。
type Internal = {
  readonly location: 'internal',
  readonly mimeType: string,
};

export type ImageEntity = EntityBase & Internal & {
  readonly type: 'image',
  readonly mediumID: string,
  readonly width: number,
  readonly height: number,
};

type VideoFields = {
  readonly type: 'video',
  // external の動画では、実際の解像度ではなく埋め込みの大きさ（縦横比として使う）。
  readonly width: number,
  readonly height: number,
  readonly duration: number,
};

export type InternalVideoEntity = EntityBase & Internal & VideoFields;

export type ExternalVideoEntity = EntityBase & VideoFields & {
  readonly location: 'external',
  // DB の external（jsonb）。platform ごとの項目を持つ。
  readonly external: ExternalVideo,
};

export type VideoEntity = InternalVideoEntity | ExternalVideoEntity;

export type AudioEntity = EntityBase & Internal & {
  readonly type: 'audio',
  duration: number,
};

export type InternalEntity = ImageEntity | InternalVideoEntity | AudioEntity;

export type ExternalEntity = ExternalVideoEntity;

// location で InternalEntity と ExternalEntity に絞り込める。
export type Entity = InternalEntity | ExternalEntity;

// 元ファイル（_storage/original）を持つか。external は持たない。
export function hasOriginalFile(entity: Entity): boolean {
  switch (entity.location) {
    case 'internal':
      return true;
    case 'external':
      return false;
  }
}

// 元ファイルの種類（DB の mime_type）。元ファイルを持たない external は null。
export function originalMimeType(entity: Entity): string | null {
  switch (entity.location) {
    case 'internal':
      return entity.mimeType;
    case 'external':
      return null;
  }
}
