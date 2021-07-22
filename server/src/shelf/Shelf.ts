import path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as protocol from 'lib/protocol';
import * as fml from 'lib/fml';
import { probe } from 'lib/media/probe';
import { resizeImage, makeImageIcon, makeVideoIcon, makeAudioIcon } from 'lib/media/convert';
import Repo from '../repo/Repo';
import Storage from '../storage/Storage';
import { Entity, ImageEntity, VideoEntity, AudioEntity } from './Entity';
import Moment, {formatMomentTime, parseMomentTime} from './Moment';
import dayjs from "dayjs";

class Shelf {
  readonly storagePath: string;
  private readonly repo: Repo;
  private readonly storage: {
    original: Storage,
    medium: Storage,
    icon: Storage,
  };
  constructor(repo: Repo) {
    this.storagePath = path.join(__dirname, '..', '..', '..', '_storage');
    this.repo = repo;
    this.storage = {
      original: new Storage(this.storagePath, 'original'),
      medium: new Storage(this.storagePath, 'medium'),
      icon: new Storage(this.storagePath, 'icon'),
    };
  }
  async findEntity(id: string): Promise<Entity | null> {
    return await this.repo.findEntity(id);
  }
  async resolveEntityPath(entity: Entity, type: 'original' | 'medium' | 'icon'): Promise<[string, string] | null> {
    switch(type) {
      case 'original':
        return this.storage.original.fetch(entity.id);
      case 'medium':
        if (entity.type === 'image') {
          return this.storage.medium.fetch(entity.mediumID);
        } else {
          return null;
        }
      case 'icon':
        return this.storage.icon.fetch(entity.iconID);
    }
  }
  async saveEntity(data: Buffer): Promise<Entity> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'the-gear-of-seasons-upload-'));
    try {
      const originalPath = path.join(tempDir, 'original');
      await fs.writeFile(originalPath, data);
      const mediumPath = path.join(tempDir, 'medium.jpg');
      const iconPath = path.join(tempDir, 'icon.jpg');
      const meta = await probe(originalPath);
      const originalID = await this.storage.original.upload(originalPath);
      let entity: Entity;
      switch (meta.type) {
        case 'image': {
          await resizeImage(originalPath, mediumPath, 2048);
          const mediumID = await this.storage.medium.upload(mediumPath);
          await makeImageIcon(originalPath, iconPath, 256);
          const iconID = await this.storage.icon.upload(iconPath);
          entity = {
            type: 'image',
            id: originalID,
            mediumID: mediumID,
            iconID: iconID,
            mimeType: meta.mimeType,
            timestamp: meta.timestamp,
            width: meta.width,
            height: meta.height,
          } as ImageEntity;
          break;
        }
        case 'video': {
          await makeVideoIcon(originalPath, iconPath, meta.duration!! / 2.0, 256);
          const iconID = await this.storage.icon.upload(iconPath);
          entity = {
            type: 'video',
            id: originalID,
            iconID: iconID,
            mimeType: meta.mimeType,
            timestamp: meta.timestamp,
            width: meta.width,
            height: meta.height,
            duration: meta.duration,
          } as VideoEntity;
          break;
        }
        case 'audio': {
          await makeAudioIcon(originalPath, iconPath, meta.duration!! * 3.0 / 4.0, 256);
          const iconID = await this.storage.icon.upload(iconPath);
          entity = {
            type: 'audio',
            id: originalID,
            iconID: iconID,
            mimeType: meta.mimeType,
            timestamp: meta.timestamp,
            duration: meta.duration,
          } as AudioEntity;
          break;
        }
        default:
          throw new Error('[FIXME] Unreachable code!');
      }
      await this.repo.registerEntity(entity);
      return entity;
    } finally {
      await fs.rm(tempDir, {
        recursive: true,
        force: true,
      });
    }
  }

  async saveMoment(req: protocol.Moment.Save.Request): Promise<Moment> {
    const m = await this.makeMoment(req);
    if (req.originalDate === null) {
      // new
      await this.repo.registerMoment(m);
    } else {
      // replace
      const oldTimestamp = parseMomentTime(req.originalDate);
      await this.repo.replaceMoment(oldTimestamp, m);
    }
    return m;
  }
  async findMomentsInYear(year: number): Promise<Moment[]> {
    return await this.repo.findMomentsInYear(year);
  }
  async findMoment(timestamp: dayjs.Dayjs): Promise<Moment | null> {
    return await this.repo.findMoment(timestamp);
  }
  private async makeMoment(req: protocol.Moment.Save.Request): Promise<Moment> {
    let date = req.date;
    if (date === null || date.length === 0) {
      const doc = fml.parse(req.text);
      for (const block of doc.blocks) {
        if (block.type === 'image' && block.entity !== undefined) {
          const e = await this.findEntity(block.entity);
          if (e === null || e.timestamp === undefined) {
            continue;
          }
          date = formatMomentTime(e.timestamp);
        }
      }
      if (date === null || date.length === 0) {
        date = formatMomentTime(dayjs());
      }
    }
    return {
      timestamp: parseMomentTime(date),
      title: req.title,
      author: req.author,
      text: req.text,
    };
  }
}

export default Shelf;
