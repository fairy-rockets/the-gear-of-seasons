import Shelf from '../../shelf/Shelf';
import {FastifyReply, FastifyRequest, RequestGenericInterface} from 'fastify';

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
    const entity = await this.shelf.find(id);
    if (entity === null) {
      reply
        .code(404)
        .type('text/plain')
        .send('Entity not found.');
      return;
    }
    const filepath = await this.shelf.fetch(entity, type);
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
      case 'medium':
        reply
          .code(200)
          .type('image/jpeg')
          .sendFile(relativePath, basePath);
        break;
      case 'icon':
        reply
          .code(200)
          .type('image/jpeg')
          .sendFile(relativePath, basePath);
        break;
    }
  }
}