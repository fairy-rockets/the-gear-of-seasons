import {FastifyReply, FastifyRequest} from 'fastify';
import dayjs from 'dayjs';

import MomentRenderer from '../../renderer/MomentRenderer.js';
import Shelf from '../../shelf/Shelf.js';
import {parseMomentPath} from '../../shelf/Moment.js';

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
  async handle(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const date = parseMomentPath(req.url.slice(7));
    const moment = await this.shelf.findMoment(date);
    if (moment === null) {
      return reply
        .type('text/plain;charset=UTF-8')
        .code(404)
        .send('Moment not found');
    }
    return reply
      .type('text/html;charset=UTF-8')
      .code(200)
      .send(await this.renderer.render(dayjs(), moment));
  }
}
