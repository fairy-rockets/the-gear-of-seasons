import path from 'path';

import {FastifyReply, FastifyRequest, RequestGenericInterface} from 'fastify';
import {fileTypeFromFile} from 'file-type';
import send, {SendOptions} from '@fastify/send';

import Shelf from '../../shelf/Shelf.js';
import { Entity, ExternalEntity, InternalEntity } from '../../shelf/Entity.js';
import { externalVideoPresentation } from '../../lib/ExternalVideoRef.js';

export interface EntityControllerInterface extends RequestGenericInterface {
  Params: {
    id: string,
  }
}

type EntityFileType = 'original' | 'medium' | 'icon';

// 送るファイル。original の Content-Type は元ファイルの種類（internal の mime_type）。
type StoredFile =
  | { readonly type: 'original', readonly contentType: string }
  | { readonly type: 'medium' }
  | { readonly type: 'icon' };

export default class EntityController {
  private readonly shelf: Shelf;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
  }
  static async create(shelf: Shelf): Promise<EntityController> {
    return new EntityController(shelf);
  }
  async handle(type: EntityFileType, _req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const req = _req as FastifyRequest<EntityControllerInterface>;
    const id = req.params.id;
    const entity = await this.shelf.findEntity(id);
    if (entity === null) {
      return reply
        .code(404)
        .type('text/plain;charset=UTF-8')
        .send('Entity not found.');
    }
    switch (entity.location) {
      case 'internal':
        return this.handleInternal(entity, type, req, reply);
      case 'external':
        return this.handleExternal(entity, type, req, reply);
    }
  }

  private async handleInternal(entity: InternalEntity, type: EntityFileType, req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    let ext;
    switch(entity.mimeType) {
      case 'image/jpeg':
        ext = '.jpeg';
        break;
      case 'image/png':
        ext = '.png';
        break;
      case 'image/gif':
        ext = '.gif';
        break;
      case 'video/mp4':
        ext = '.mp4';
        break;
      case 'video/webm':
        ext = '.webm';
        break;
      case 'audio/x-flac':
        ext = '.flac';
        break;
      default:
        return reply
          .code(500)
          .type('text/plain;charset=UTF-8')
          .send(`Unsupported mime type: ${entity.mimeType}`);
    }
    const file: StoredFile = type === 'original'
      ? { type: 'original', contentType: entity.mimeType }
      : { type };
    return this.sendFile(entity, file, ext, req, reply);
  }

  // 外部（今は YouTube だけ）の動画の元は外部のページ（platform ごとに external の中身から組み立てる）。storage には icon だけを持つ。
  private async handleExternal(entity: ExternalEntity, type: EntityFileType, req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    if (type === 'original') {
      return reply.redirect(externalVideoPresentation(entity.external).pageURL, 302);
    }
    // 元ファイルが無いので、ファイル名に付ける拡張子も無い。
    return this.sendFile(entity, { type }, '', req, reply);
  }

  private async sendFile(entity: Entity, file: StoredFile, ext: string, req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const id = entity.id;
    const filepath = await this.shelf.resolveEntityPath(entity, file.type);
    if (filepath === null) {
      return reply
        .code(404)
        .type('text/plain')
        .send('Entity file has been lost.');
    }
    const [rootPath, entityPath] = filepath;

    // Make a file stream
    const sendOption: SendOptions = {
      'acceptRanges': true,
      // 'maxChunkSize': 1024 * 1024 * 8,
      // 'cacheControl': true,
      'root': rootPath,
      // 'immutable': true,
      // 'maxAge': 24 * 3600 * 7 * 1000,
    };
    const sendResult = await send(req.raw, encodeURI(entityPath), sendOption);
    if (sendResult.type !== 'file') {
      let msg;
      switch (sendResult.type) {
        case 'error':
          msg = `[BUG] Invalid SendResult. Error: ${sendResult.metadata.error}`;
          break;
        case 'directory':
          msg = `[BUG] Invalid SendResult. Directory is specified, please give me a filepath.`;
      }
      return reply
        .code(500)
        .type('text/plain;charset=UTF-8')
        .send(msg);
    }
    const stream = sendResult.stream;

    switch (file.type) {
      case 'original':
        return reply
          .code(sendResult.statusCode)
          .headers(sendResult.headers)
          .type(file.contentType)
          .header('content-disposition', `inline; filename=\"${id+".original"+ext}\"`)
          .send(stream);
      case 'medium': {
        const meta = await fileTypeFromFile(path.join(rootPath, entityPath));
        if(meta === undefined || meta.mime === undefined) {
          return reply
          .code(500)
          .type('text/plain;charset=UTF-8')
          .send('Failed to probe entity.');
        }
        return reply
          .code(sendResult.statusCode)
          .headers(sendResult.headers)
          .type(meta.mime)
          .header('content-disposition', `inline; filename=\"${id+".medium"+ext}\"`)
          .send(stream);
      }
      case 'icon':
        return reply
          .code(sendResult.statusCode)
          .headers(sendResult.headers)
          .type('image/jpeg')
          .header("content-disposition", `inline; filename=\"${id+".icon"+ext}\"`)
          .send(stream);
    }
  }
}
