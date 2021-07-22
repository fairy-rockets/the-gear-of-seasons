import Shelf from '../../shelf/Shelf';
import {FastifyReply, FastifyRequest} from 'fastify';

export default class UploadController {
  private readonly shelf: Shelf;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
  }
  static async create(shelf: Shelf): Promise<UploadController> {
    return new UploadController(shelf);
  }
  async handle(req: FastifyRequest, reply: FastifyReply) {
    const entity = await this.shelf.saveEntity(req.body as Buffer);
    reply
      .type('text/plain')
      .code(200)
      .send(`[${entity.type} entity="${entity.id}"]`);
  }
}