import { FastifyReply, FastifyRequest } from 'fastify';
import * as protocol from 'lib/protocol';
import Shelf from '../../shelf/Shelf';
import {formatMomentPath, formatMomentTime} from '../../shelf/Moment';
import MomentRenderer from '../../renderer/MomentRenderer';

export default class SaveController {
  private readonly shelf: Shelf;
  private readonly renderer: MomentRenderer;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
    this.renderer = new MomentRenderer(this.shelf);
  }
  static async create(shelf: Shelf): Promise<SaveController> {
    return new SaveController(shelf);
  }
  async handle(req: FastifyRequest, reply: FastifyReply) {
    const moment = await this.shelf.saveMoment(req.body as protocol.Moment.Save.Request);
    if (moment.timestamp === undefined) {
      reply
        .type('plain/text')
        .code(500)
        .send('No timestamp!');
      return;
    }
    const resp: protocol.Moment.Save.Response = {
      path: formatMomentPath(moment.timestamp),
      date: formatMomentTime(moment.timestamp),
      body: await this.renderer.render(moment),
    };
    reply
      .type('application/json')
      .code(200)
      .send(resp);
  }
}
