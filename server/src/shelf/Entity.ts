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
  readonly mimeType: string,
  readonly location: EntityLocation,
};

type Internal = {
  readonly location: 'internal',
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

// location === 'external' で ExternalVideoEntity に絞り込める。
export type Entity = ImageEntity | VideoEntity | AudioEntity;
