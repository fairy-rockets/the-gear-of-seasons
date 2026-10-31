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
import { EntityAnnotation, validateEntityAnnotation } from './EntityAnnotation.js';
import {
  Moment,
  MomentSummary,
  MomentVisibility,
  formatMomentTime,
  momentIconID,
  parseMomentSeries,
  parseMomentStatus,
  parseMomentTier,
  parseMomentTime,
  parseSensitiveOverride,
} from './Moment.js';
import { computeSensitive, sensitiveTargetEntityIDs } from './Sensitive.js';
import { momentListItem, momentMedia } from './MomentList.js';

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

  /* ***********************************************************************************************
   * Entity
   ********************************************************************************************** */

  enumurateAllEntities(): AsyncGenerator<Entity> {
    return this.repo.enumurateAllEntities();
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
      const mediumPath =
        entity.mimeType === 'image/gif' ? path.join(tempDir, 'medium.gif') :
                                          path.join(tempDir, 'medium.jpg');
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
          await resizeImage(originalPath, mediumPath, 2048);
          const mediumID = await this.storage.medium.upload(mediumPath);
          await makeImageIcon(originalPath, iconPath, 256);
          const iconID = await this.storage.icon.upload(iconPath);
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

  async resolveFilepaths(entity: Entity): Promise<Set<string>> {
    const set = new Set<string>();
    const originalPath = this.storage.original.resolveAbsolutePath(entity.id);
    if (originalPath !== null) {
      set.add(originalPath);
    }
    const iconPath = this.storage.icon.resolveAbsolutePath(entity.iconID);
    if (iconPath !== null) {
      set.add(iconPath);
    }
    switch (entity.type) {
      case 'audio':
        break;
      case 'video':
        break;
      case 'image': {
        const mediumPath = this.storage.medium.resolveAbsolutePath(entity.mediumID);
        if (mediumPath !== null) {
          set.add(mediumPath);
        }
      }
        break;
    }
    return set;
  }

  // ura の SAVE。import-curation もこれで書く。Save.Request のすべての項目を書く。
  // sensitive は、sensitiveOverride が true / false ならその値（手での上書き）、null なら本文と注釈から計算した値（自動）にする。
  async updateMoment(req: protocol.Moment.Save.Request): Promise<Moment> {
    const fields = await this.makeMomentFromRequest(req);
    const override = parseSensitiveOverride(req.sensitiveOverride);
    let oldTimestamp: dayjs.Dayjs | null = null;
    if (req.originalDate !== null) {
      oldTimestamp = parseMomentTime(req.originalDate);
      if (!oldTimestamp.isValid()) {
        throw new Error(`Invalid old date: ${req.originalDate}`);
      }
    }
    // 計算に使う注釈と書き込みを、同じトランザクションにする。
    return await this.repo.transaction(async (tx) => {
      const m: Moment = {
        ...fields,
        sensitive: override ?? await calcSensitive(tx, fields.text),
        sensitiveManual: override !== null,
      };
      if (oldTimestamp === null) {
        // new
        await tx.insertMoment(m);
      } else {
        // update
        if (!await tx.updateMoment(oldTimestamp, m)) {
          throw new Error(`Moment not found: ${req.originalDate}`);
        }
      }
      return m;
    });
  }

  /* ***********************************************************************************************
   * Moment
   ********************************************************************************************** */

  // sensitive 以外の項目。sensitive は updateMoment がトランザクションの中で決める。
  private async makeMomentFromRequest(req: protocol.Moment.Save.Request): Promise<Omit<Moment, 'sensitive' | 'sensitiveManual'>> {
    const status = parseMomentStatus(req.status);
    const tier = parseMomentTier(req.tier);
    const series = parseMomentSeries(req.series);
    let date = req.date;
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
    const timestamp = parseMomentTime(date);
    if (!timestamp.isValid()) {
      throw new Error(`Invalid timestamp: ${date}`);
    }
    return {
      timestamp: timestamp,
      title: req.title,
      author: req.author,
      text: req.text,
      iconID: momentIconID(doc),
      status: status,
      tier: tier,
      series: series,
    };
  }

  // 下書きも含めた全件。gc などが使用中の entity を数えるのに使うので、絞らない。
  enumurateAllMoments(): AsyncGenerator<Moment> {
    return this.repo.enumurateAllMoments();
  }

  // 以下、visibility は omote から呼ぶなら 'published'、ura から呼ぶなら 'all'。
  // ura の一覧（/moments/）の要約。新しい順。注釈は1度にまとめて引く。
  async findMomentListItems(visibility: MomentVisibility): Promise<protocol.Moment.List.Item[]> {
    const moments = await this.repo.findAllMoments(visibility);
    const docs = moments.map((m) => fml.parse(m.text));
    const ids = [...new Set(docs.flatMap((doc) => momentMedia(doc).map((it) => it.entity)))];
    const annotations = await this.repo.findEntityAnnotations(ids);
    return moments.map((m, i) => momentListItem(m, docs[i], annotations));
  }

  async findMoment(timestamp: dayjs.Dayjs, visibility: MomentVisibility): Promise<Moment | null> {
    return await this.repo.findMoment(timestamp, visibility);
  }

  async findMomentSummariesByRandom(size: number, visibility: MomentVisibility): Promise<MomentSummary[]> {
    return await this.repo.findMomentSummariesByRandom(size, visibility);
  }

  async findAllMomentSummaries(visibility: MomentVisibility): Promise<MomentSummary[]> {
    return await this.repo.findAllMomentSummaries(visibility);
  }

  async findPreviousMomentSummary(timestamp: dayjs.Dayjs, visibility: MomentVisibility): Promise<MomentSummary | null> {
    return await this.repo.findPreviousMomentSummary(timestamp, visibility);
  }

  async findNextMomentSummary(timestamp: dayjs.Dayjs, visibility: MomentVisibility): Promise<MomentSummary | null> {
    return await this.repo.findNextMomentSummary(timestamp, visibility);
  }

  async deleteMoment(timestamp: dayjs.Dayjs): Promise<boolean> {
    return await this.repo.deleteMoment(timestamp);
  }

  /* ***********************************************************************************************
   * Curation
   ********************************************************************************************** */

  // 本文から計算した sensitive の値（sanity-check が保存されている値と比べるのと、ura の編集画面が自動の値を見せるのに使う）。
  async computeSensitive(text: string): Promise<boolean> {
    return await calcSensitive(this.repo, text);
  }

  async findEntityAnnotation(entityID: string): Promise<EntityAnnotation | null> {
    return await this.repo.findEntityAnnotation(entityID);
  }

  // 注釈の行が無い entity は、返す Map に入らない。
  async findEntityAnnotations(entityIDs: string[]): Promise<Map<string, EntityAnnotation>> {
    return await this.repo.findEntityAnnotations(entityIDs);
  }

  // 注釈を保存し、同じトランザクションで、その entity を本文の [image]・[video] に含む moment の
  // sensitive を計算し直す（sensitive_manual = true のものは除く）。
  async saveEntityAnnotation(annotation: EntityAnnotation) {
    await this.repo.transaction(async (tx) => {
      const entity = await tx.findEntity(annotation.entityID);
      if (entity === null) {
        throw new Error(`Entity not found: ${annotation.entityID}`);
      }
      validateEntityAnnotation(entity, annotation);
      await tx.upsertEntityAnnotation(annotation);
      for (const moment of await tx.findAutoSensitiveMomentCandidates(entity.id)) {
        const doc = fml.parse(moment.text);
        const ids = sensitiveTargetEntityIDs(doc);
        if (!ids.includes(entity.id)) {
          continue;
        }
        // 保存したばかりの注釈が見えるよう、tx から読む。
        const annotations = await tx.findEntityAnnotations(ids);
        await tx.updateMomentAutoSensitive(moment.timestamp!!, computeSensitive(doc, annotations));
      }
    });
  }
}

// 本文（FML）と、repo から読んだ注釈から sensitive を計算する。トランザクションの中では repo に tx を渡す。
async function calcSensitive(repo: Repo, text: string): Promise<boolean> {
  const doc = fml.parse(text);
  const annotations = await repo.findEntityAnnotations(sensitiveTargetEntityIDs(doc));
  return computeSensitive(doc, annotations);
}

export default Shelf;
