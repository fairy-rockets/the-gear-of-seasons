import {FastifyReply, FastifyRequest} from 'fastify';
import MomentRenderer from '../../renderer/MomentRenderer';
import Shelf from '../../shelf/Shelf';
import {parseMomentPath} from '../../shelf/Moment';
import dayjs from "dayjs";

export default class MomentBodyController {
  private readonly shelf: Shelf;
  private readonly renderer: MomentRenderer;
  private constructor(shelf: Shelf) {
    this.shelf = shelf;
    this.renderer = new MomentRenderer(shelf);
  }
  static async create(shelf: Shelf): Promise<MomentBodyController> {
    return new MomentBodyController(shelf);
  }
  async handle(req: FastifyRequest, reply: FastifyReply) {
    const date = parseMomentPath(req.url.slice(7));
    const moment = await this.shelf.findMoment(date);
    if (moment === null) {
      reply
        .type('text/plain')
        .code(404)
        .send('Moment not found');
      return;
    }
    reply
      .type('text/html')
      .code(200)
      .send(await this.renderer.render(dayjs(), moment));
  }
}
