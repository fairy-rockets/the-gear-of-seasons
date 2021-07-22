import path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { probe } from 'lib/media/probe';
import { resizeImage, makeImageIcon, makeVideoIcon, makeAudioIcon } from 'lib/media/convert';
import Repo from '../repo/Repo';
import Storage from '../storage/Storage';
import { Entity, ImageEntity, VideoEntity, AudioEntity } from './Entity';

class Shelf {
  private readonly path: string;
  private readonly repo: Repo;
  private readonly storage: {
    original: Storage,
    medium: Storage,
    icon: Storage,
  };
  constructor(repo: Repo) {
    this.path = path.join(__dirname, '..', '..', '..', '_shelf');
    this.repo = repo;
    this.storage = {
      original: new Storage('original'),
      medium: new Storage('medium'),
      icon: new Storage('icon'),
    };
  }
  async find(id: string): Promise<Entity | null> {
    return await this.repo.findEntity(id);
  }
  async fetch(entity: Entity, type: 'original' | 'medium' | 'icon'): Promise<string | null> {
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
  async upload(data: Buffer): Promise<Entity> {
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
}

export default Shelf;
