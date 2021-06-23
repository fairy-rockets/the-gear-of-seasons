type EntityBase = {
  id: string;
  type: 'image' | 'video' | 'audio';
  mimeType: string,
};

type ImageEntity = EntityBase & {
  width: number,
  height: number,
};

type VideoEntity = EntityBase & {
  width: number,
  height: number,
  duration: number,
};

type AudioEntity = EntityBase & {
  duration: number,
};

type Entity = ImageEntity | VideoEntity | AudioEntity;

export {
  Entity,
  ImageEntity,
  VideoEntity,
  AudioEntity,
};