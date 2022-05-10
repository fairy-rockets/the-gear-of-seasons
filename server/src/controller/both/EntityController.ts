import path from 'path';

import {FastifyReply, FastifyRequest, RequestGenericInterface} from 'fastify';
import { fileTypeFromFile } from 'file-type';

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
  async handle(type: 'original' | 'medium' | 'icon', req: FastifyRequest<EntityControllerInterface>, reply: FastifyReply) {
    const id = req.params.id;
    const entity = await this.shelf.findEntity(id);
    if (entity === null) {
      reply
        .code(404)
        .type('text/plain')
        .send('Entity not found.');
      return;
    }
    const filepath = await this.shelf.resolveEntityPath(entity, type);
    if (filepath === null) {
      reply
        .code(404)
        .type('text/plain')
        .send('Entity file has been lost.');
      return;
    }
    const [basePath, relativePath] = filepath;
    switch (type) {
      case 'original':
        reply
          .code(200)
          .type(entity.mimeType)
          .sendFile(relativePath, basePath);
        break;
      case 'medium': {
        const meta = await fileTypeFromFile(path.join(basePath, relativePath));
        if(meta === undefined || meta.mime === undefined) {
          reply
          .code(500)
          .type('text/plain')
          .send('Failed to probe entity.');
          break;
        }
        reply
          .code(200)
          .type(meta.mime)
          .sendFile(relativePath, basePath);
        break;
      }
      case 'icon':
        reply
          .code(200)
          .type('image/jpeg')
          .sendFile(relativePath, basePath);
        break;
    }
  }
}