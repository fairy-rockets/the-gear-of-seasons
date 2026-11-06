import dayjs from 'dayjs';

import { ExternalVideo } from '../lib/ExternalVideoFormat.js';

export type { ExternalVideo };

// entity の型は、「どこに置いてあるか」の Base と、「何のメディアか」の Traits を組み合わせて作る。

// entity の元の置き場所。DB の location。
// internal は元ファイルを _storage/original に持つ。external はサーバーの外（YouTube など）にあり、icon だけを storage に持つ。
// external になれるのは video だけ（DB の CHECK も同じ）。
export type EntityLocation = 'internal' | 'external';

// どの entity も持つもの。
type EntityBase = {
  readonly id: string,
  readonly iconID: string,
  readonly timestamp: dayjs.Dayjs | undefined,
};

// 元ファイルを持つ entity。mimeType は元ファイルの種類。
type InternalEntityBase = EntityBase & {
  readonly location: 'internal',
  readonly mimeType: string,
};

// サーバーの外にある entity。external は DB の external（jsonb）で、platform ごとの項目を持つ。
type ExternalEntityBase = EntityBase & {
  readonly location: 'external',
  readonly external: ExternalVideo,
};

type ImageTraits = {
  readonly type: 'image',
  readonly mediumID: string,
  readonly width: number,
  readonly height: number,
};

type VideoTraits = {
  readonly type: 'video',
  // external の動画では、実際の解像度ではなく埋め込みの大きさ（縦横比として使う）。
  readonly width: number,
  readonly height: number,
  readonly duration: number,
};

type AudioTraits = {
  readonly type: 'audio',
  readonly duration: number,
};

export type ImageEntity = InternalEntityBase & ImageTraits;

export type InternalVideoEntity = InternalEntityBase & VideoTraits;

export type ExternalVideoEntity = ExternalEntityBase & VideoTraits;

export type VideoEntity = InternalVideoEntity | ExternalVideoEntity;

export type AudioEntity = InternalEntityBase & AudioTraits;

export type InternalEntity = ImageEntity | InternalVideoEntity | AudioEntity;

export type ExternalEntity = ExternalVideoEntity;

// location で InternalEntity と ExternalEntity に絞り込める。
export type Entity = InternalEntity | ExternalEntity;
