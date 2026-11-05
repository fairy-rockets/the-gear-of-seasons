import path from 'path';

import {FastifyReply, FastifyRequest, RequestGenericInterface} from 'fastify';
import {fileTypeFromFile} from 'file-type';
import send, {SendOptions} from '@fastify/send';

import Shelf from '../../shelf/Shelf.js';
import { externalVideoPageURL } from '../../lib/ExternalVideoFormat.js';

export interface EntityControllerInterface extends RequestGenericInterface {
  Params: {
    id: string,
  }
}

export default class EntityController {
  private readonly shelf: Shelf;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
  }
  static async create(shelf: Shelf): Promise<EntityController> {
    return new EntityController(shelf);
  }
  async handle(type: 'original' | 'medium' | 'icon', _req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const req = _req as FastifyRequest<EntityControllerInterface>;
    const id = req.params.id;
    const entity = await this.shelf.findEntity(id);
    if (entity === null) {
      return reply
        .code(404)
        .type('text/plain;charset=UTF-8')
        .send('Entity not found.');
    }
    // 外部（YouTube）の動画の元は、外部のページ（platform ごとに external の中身から組み立てる）。icon だけを storage に持つ。
    if (entity.location === 'external' && type === 'original') {
      return reply.redirect(externalVideoPageURL(entity.external), 302);
    }
    const filepath = await this.shelf.resolveEntityPath(entity, type);
    if (filepath === null) {
      return reply
        .code(404)
        .type('text/plain')
        .send('Entity file has been lost.');
    }
    // mime_type は元ファイルの種類なので、external は持たない。
    const mimeType = entity.location === 'internal' ? entity.mimeType : null;
    let ext;
    switch(mimeType) {
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
      case null:
        // external には元ファイルが無く（original は上でリダイレクトした）、ここまで来るのは icon だけ。
        ext = '';
        break;
      default:
        return reply
          .code(500)
          .type('text/plain;charset=UTF-8')
          .send(`Unsupported mime type: ${mimeType}`);
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

    switch (type) {
      case 'original':
        return reply
          .code(sendResult.statusCode)
          .headers(sendResult.headers)
          // original は internal だけ（external は上でリダイレクトした）。
          .type(mimeType!!)
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
      default:
        return reply
          .code(500)
          .type('text/plain;charset=UTF-8')
          .send('Unknown entity type.');
    }
  }
}
