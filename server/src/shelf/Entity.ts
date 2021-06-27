import dayjs from "dayjs";

type EntityBase = {
  id: string;
  timestamp: dayjs.Dayjs,
  mimeType: string,
};

type ImageEntity = EntityBase & {
  type: 'image',
  width: number,
  height: number,
};

type VideoEntity = EntityBase & {
  type: 'video',
  width: number,
  height: number,
  duration: number,
};

type AudioEntity = EntityBase & {
  type: 'audio',
  duration: number,
};

type Entity = ImageEntity | VideoEntity | AudioEntity;

export {
  Entity,
  ImageEntity,
  VideoEntity,
  AudioEntity,
};