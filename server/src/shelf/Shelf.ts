import path from 'path';
import { fileURLToPath } from 'url';
import * as os from 'os';
import * as fs from 'fs/promises';
import dayjs from 'dayjs';

import * as protocol from '../lib/protocol.js';
import * as fml from '../lib/fml.js';
import { probe } from '../lib/media/Probe.js';
import { resizeImage, makeImageIcon, makeVideoIcon, makeAudioIcon } from '../lib/media/Convert.js';

import Repo from '../repo/Repo.js';
import Storage from '../storage/Storage.js';
import { Entity, ImageEntity, VideoEntity, AudioEntity } from './Entity.js';
import { Moment, MomentSummary, formatMomentTime, parseMomentTime } from './Moment.js';

const dirname = path.dirname(fileURLToPath(import.meta.url))

class Shelf {
  readonly storagePath: string;
  private readonly repo: Repo;
  private readonly storage: {
    original: Storage,
    medium: Storage,
    icon: Storage,
  };
  constructor(repo: Repo) {
    this.storagePath = path.join(dirname, '..', '..', '..', '_storage');
    this.repo = repo;
    this.storage = {
      original: new Storage(this.storagePath, 'original'),
      medium: new Storage(this.storagePath, 'medium'),
      icon: new Storage(this.storagePath, 'icon'),
    };
  }

  enumurateAllEntries(): AsyncGenerator<Entity> {
    return this.repo.enumurateAllEntries();
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

  async insertEntity(data: Buffer): Promise<Entity> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'the-gear-of-seasons-upload-'));
    try {
      const tempPath = path.join(tempDir, 'temp');
      await fs.writeFile(tempPath, data);
      const meta = await probe(tempPath);
      const originalPath = path.join(tempDir, `original.${meta.ext}`);
      await fs.rename(tempPath, originalPath);
      const mediumPath = path.join(tempDir, 'medium.jpg');
      const iconPath = path.join(tempDir, 'icon.jpg');
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
      await this.repo.insertEntity(entity);
      return entity;
    } finally {
      await fs.rm(tempDir, {
        recursive: true,
        force: true,
      });
    }
  }
  async deleteEntity(e: Entity) {
    switch(e.type) {
      case 'image':
        await this.storage.original.remove(e.id);
        await this.storage.medium.remove(e.mediumID);
        await this.storage.icon.remove(e.iconID);
        await this.repo.deleteEntity(e);
        break;
      case 'audio':
        await this.storage.original.remove(e.id);
        await this.storage.icon.remove(e.iconID);
        await this.repo.deleteEntity(e);
        break;
      case 'video':
        await this.storage.original.remove(e.id);
        await this.storage.icon.remove(e.iconID);
        await this.repo.deleteEntity(e);
        break;
    }
  }
  async regenerateEntityCache(entity: Entity) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'the-gear-of-seasons-upload-'));
    try {
      const mediumPath = (() => {
        if(entity.mimeType === 'image/gif') {
          return path.join(tempDir, 'medium.gif');
        }
        return path.join(tempDir, 'medium.jpg');
      })();
      const iconPath = path.join(tempDir, 'icon.jpg');
      const [originalPath, probeResult] = await (async () => {
        const [base, filename] = (await this.storage.original.fetch(entity.id))!!;
        const probeResult = await probe(path.join(base, filename));
        const originalPath = path.join(tempDir, `original.${probeResult.ext}`);
        await fs.copyFile(path.join(base, filename), originalPath);
        return [originalPath, probeResult];
      })();
      let newEntity: Entity;
      switch (entity.type) {
        case 'image': {
          const mediumID = await this.storage.medium.upload(mediumPath);
          await resizeImage(originalPath, mediumPath, 2048);
          const iconID = await this.storage.icon.upload(iconPath);
          await makeImageIcon(originalPath, iconPath, 256);
          newEntity = {
            type: 'image',
            id: entity.id,
            mediumID: mediumID,
            iconID: iconID,
            mimeType: entity.mimeType,
            timestamp: entity.timestamp,
            width: probeResult.width!!,
            height: probeResult.height!!,
          } as ImageEntity;
          break;
        }
        case 'video': {
          await makeVideoIcon(originalPath, iconPath, entity.duration!! / 2.0, 256);
          const iconID = await this.storage.icon.upload(iconPath);
          newEntity = {
            type: 'video',
            id: entity.id,
            iconID: iconID,
            mimeType: entity.mimeType,
            timestamp: entity.timestamp,
            width: probeResult.width,
            height: probeResult.height,
            duration: probeResult.duration,
          } as VideoEntity;
          break;
        }
        case 'audio': {
          await makeAudioIcon(originalPath, iconPath, entity.duration!! * 3.0 / 4.0, 256);
          const iconID = await this.storage.icon.upload(iconPath);
          newEntity = {
            type: 'audio',
            id: entity.id,
            iconID: iconID,
            mimeType: entity.mimeType,
            timestamp: entity.timestamp,
            duration: probeResult.duration,
          } as AudioEntity;
          break;
        }
        default:
          throw new Error('[FIXME] Unreachable code!');
      }
      await this.repo.updateEntity(newEntity);
      return entity;
    } finally {
      await fs.rm(tempDir, {
        recursive: true,
        force: true,
      });
    }
  }


  async updateMoment(req: protocol.Moment.Save.Request): Promise<Moment> {
    const m = await this.makeMomentFromRequest(req);
    if (req.originalDate === null) {
      // new
      await this.repo.insertMoment(m);
    } else {
      // update
      const oldTimestamp = parseMomentTime(req.originalDate);
      if (!oldTimestamp.isValid()) {
        throw new Error(`Invalid old date: ${req.originalDate}`);
      }
      await this.repo.updateMoment(oldTimestamp, m);
    }
    return m;
  }
  enumurateAllMoments(): AsyncGenerator<Moment> {
    return this.repo.enumurateAllMoments();
  }
  async findMomentSummariesInYear(year: number): Promise<MomentSummary[]> {
    return await this.repo.findMomentSummariesInYear(year);
  }
  async findMoment(timestamp: dayjs.Dayjs): Promise<Moment | null> {
    return await this.repo.findMoment(timestamp);
  }
  async findMomentSummariesByRandom(size: number): Promise<MomentSummary[]> {
    return await this.repo.findMomentSummariesByRandom(size);
  }
  async deleteMoment(timestamp: dayjs.Dayjs): Promise<boolean> {
    return await this.repo.deleteMoment(timestamp);
  }
  private async makeMomentFromRequest(req: protocol.Moment.Save.Request): Promise<Moment> {
    let date = req.date;
    let iconID: string | undefined = undefined;
    const doc = fml.parse(req.text);
    if (date === null || date.length === 0) {
      for (const block of doc.blocks) {
        if (block.type === 'image' && block.entity !== undefined) {
          const e = await this.findEntity(block.entity);
          if (e === null || e.timestamp === undefined) {
            continue;
          }
          date = formatMomentTime(e.timestamp);
          break;
        }
      }
      if (date === null || date.length === 0) {
        date = formatMomentTime(dayjs());
      }
    }
    for (const block of doc.blocks) {
      let found = false;
      switch (block.type) {
        case 'image':
          if (block.entity !== undefined) {
            iconID = block.entity;
            found = true;
          }
          break;
        case 'video':
        case 'audio':
          if (block.entity !== undefined && iconID === undefined) {
            iconID = block.entity;
          }
          break;
      }
      if (found) {
        break;
      }
    }
    const timestamp = parseMomentTime(date);
    if (!timestamp.isValid()) {
      throw new Error(`Invalid timestamp: ${date}`);
    }
    return {
      timestamp: timestamp,
      title: req.title,
      author: req.author,
      text: req.text,
      iconID: iconID,
    };
  }

}

export default Shelf;
