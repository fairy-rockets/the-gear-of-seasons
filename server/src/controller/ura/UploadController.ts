import {FastifyReply, FastifyRequest} from 'fastify';

import Shelf from '../../shelf/Shelf.js';

export default class UploadController {
  private readonly shelf: Shelf;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
  }
  static async create(shelf: Shelf): Promise<UploadController> {
    return new UploadController(shelf);
  }
  async handle(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const entity = await this.shelf.insertEntity(req.body as Buffer);
    return reply
      .type('text/plain;charset=UTF-8')
      .code(200)
      .send(`[${entity.type} entity="${entity.id}"]`);
  }
}