import path from 'path';

import {FastifyReply, FastifyRequest, RequestGenericInterface} from 'fastify';
import {fileTypeFromFile} from 'file-type';

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
        ext = 'jpeg';
        break;
      case 'image/png':
        ext = 'png';
        break;
      case 'image/gif':
        ext = 'gif';
        break;
      case 'video/mp4':
        ext = 'mp4';
        break;
      case 'audio/x-flac':
        ext = 'flac';
      default:
        return reply
          .code(500)
          .type('text/plain;charset=UTF-8')
          .send(`Unsupported mime type: ${entity.mimeType}`);
    }
    const [basePath, relativePath] = filepath;
    switch (type) {
      case 'original':
        return reply
          .code(200)
          .type(entity.mimeType)
          .header("content-disposition", `attachment; filename=\"${id+".original."+ext}\"`)
          .sendFile(relativePath, basePath);
      case 'medium': {
        const meta = await fileTypeFromFile(path.join(basePath, relativePath));
        if(meta === undefined || meta.mime === undefined) {
          return reply
          .code(500)
          .type('text/plain;charset=UTF-8')
          .send('Failed to probe entity.');
        }
        return reply
          .code(200)
          .type(meta.mime)
          .header("content-disposition", `attachment; filename=\"${id+".medium."+ext}\"`)
          .sendFile(relativePath, basePath);
      }
      case 'icon':
        return reply
          .code(200)
          .type('image/jpeg')
          .header("content-disposition", `attachment; filename=\"${id+".icon."+ext}\"`)
          .sendFile(relativePath, basePath);
      default:
        return reply
          .code(500)
          .type('text/plain;charset=UTF-8')
          .send('Unknown entity type.');
    }
  }
}
