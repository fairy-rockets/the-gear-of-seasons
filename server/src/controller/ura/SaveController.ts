import Shelf from '../../shelf/Shelf';
import {FastifyReply, FastifyRequest} from 'fastify';

export default class SaveController {
  private readonly shelf: Shelf;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
  }
  static async create(shelf: Shelf): Promise<SaveController> {
    return new SaveController(shelf);
  }
  async handle(req: FastifyRequest, reply: FastifyReply) {
    //const entity = await this.shelf.saveMoment(req.body as MomentData);
    reply
      .type('application/json')
      .code(200)
      .send({});
  }
}