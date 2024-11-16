import path from 'path';

import {FastifyReply, FastifyRequest, RequestGenericInterface} from 'fastify';
import {fileTypeFromFile} from 'file-type';
import send, {SendOptions} from '@fastify/send';

import Shelf from '../../shelf/Shelf.js';

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
    const filepath = await this.shelf.resolveEntityPath(entity, type);
    if (filepath === null) {
      return reply
        .code(404)
        .type('text/plain')
        .send('Entity file has been lost.');
    }
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
      case 'audio/x-flac':
        ext = '.flac';
      default:
        return reply
          .code(500)
          .type('text/plain;charset=UTF-8')
          .send(`Unsupported mime type: ${entity.mimeType}`);
    }
    const [rootPath, entityPath] = filepath;

    // Make a file stream
    const sendOption: SendOptions = {
      'acceptRanges': true,
      'cacheControl': true,
      'root': rootPath,
      'immutable': true,
      'maxAge': 24 * 3600 * 7,
    };
    const sendResult = await send(req.raw, encodeURI(entityPath), sendOption);
    if (sendResult.type === 'directory') {
      return reply
        .code(500)
        .type('text/plain;charset=UTF-8')
        .send(`[BUG] Invalid SendResult. Directory is specified, please give me a filepath.`);
    }
    if (sendResult.type === 'error') {
      return reply
        .code(500)
        .type('text/plain;charset=UTF-8')
        .send(`[BUG] Invalid SendResult. Error: ${sendResult.metadata.error}`);
    }
    if (sendResult.statusCode !== 200) {
      return reply
        .code(sendResult.statusCode)
        .type('text/plain;charset=UTF-8')
        .send(`[BUG] Failed to make stream`);
    }
    const stream = sendResult.stream;

    switch (type) {
      case 'original':
        return reply
          .code(200)
          .type(entity.mimeType)
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
          .code(200)
          .type(meta.mime)
          .header('content-disposition', `inline; filename=\"${id+".medium"+ext}\"`)
          .send(stream);
      }
      case 'icon':
        return reply
          .code(200)
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
