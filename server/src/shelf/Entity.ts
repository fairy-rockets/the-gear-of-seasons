import dayjs from 'dayjs';
import {ProbeResult} from 'lib/dist/media';

type EntityBase = {
  id: string;
  mediumID: string,
  thumbnailID: string,
  timestamp: dayjs.Dayjs,
  mimeType: string,
};

type ImageEntity = EntityBase & {
  readonly type: 'image',
  width: number,
  height: number,
};

type VideoEntity = EntityBase & {
  readonly type: 'video',
  width: number,
  height: number,
  duration: number,
};

type AudioEntity = EntityBase & {
  readonly type: 'audio',
  duration: number,
};

type Entity = ImageEntity | VideoEntity | AudioEntity;

function entityFromProbeResult(p: ProbeResult): Entity {
  switch (p.type) {
    case 'image':
      return {
        type: 'image',
        id: '',
        mediumID: '',
        thumbnailID: '',
        timestamp: dayjs(),
        width: p.width!!,
        height: p.height!!,
        mimeType: p.mimeType,
      } as ImageEntity;
    case 'video':
      return {
        type: 'video',
        id: '',
        mediumID: '',
        thumbnailID: '',
        timestamp: dayjs(),
        mimeType: p.mimeType,
        width: p.width,
        height: p.height,
        duration: p.duration!!,
      } as VideoEntity;
    case 'audio':
      return {
        type: 'audio',
        id: '',
        mediumID: '',
        thumbnailID: '',
        timestamp: dayjs(),
        mimeType: p.mimeType,
        duration: p.duration!!,
      } as AudioEntity;
  }
}

export {
  Entity,
  ImageEntity,
  VideoEntity,
  AudioEntity,
  entityFromProbeResult,
};