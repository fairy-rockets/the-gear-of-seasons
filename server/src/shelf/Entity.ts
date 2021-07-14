import dayjs from 'dayjs';
import {ProbeResult} from 'lib/dist/media';

type EntityBase = {
  readonly id: string;
  readonly iconID: string,
  readonly timestamp: dayjs.Dayjs,
  readonly mimeType: string,
};

export type ImageEntity = EntityBase & {
  readonly type: 'image',
  readonly mediumID: string,
  readonly width: number,
  readonly height: number,
};

export type VideoEntity = EntityBase & {
  readonly type: 'video',
  readonly width: number,
  readonly height: number,
  readonly duration: number,
};

export type AudioEntity = EntityBase & {
  readonly type: 'audio',
  duration: number,
};

export type Entity = ImageEntity | VideoEntity | AudioEntity;
