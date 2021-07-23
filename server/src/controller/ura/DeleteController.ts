import dayjs from 'dayjs';
import { FastifyReply, FastifyRequest } from 'fastify';

import * as protocol from 'lib/protocol';

import Shelf from '../../shelf/Shelf';
import { parseMomentTime } from '../../shelf/Moment';
import MomentRenderer from '../../renderer/MomentRenderer';

export default class DeleteController {
  private readonly shelf: Shelf;
  private readonly renderer: MomentRenderer;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
    this.renderer = new MomentRenderer(this.shelf);
  }
  static async create(shelf: Shelf): Promise<DeleteController> {
    return new DeleteController(shelf);
  }
  async handle(req: FastifyRequest, reply: FastifyReply) {
    const r = req.body as protocol.Moment.Delete.Request;
    const timestamp = parseMomentTime(r.date)
    const result = await this.shelf.deleteMoment(timestamp);
    if (!result) {
      reply
        .type('plain/text')
        .code(500)
        .send('Moment not found!');
      return;
    }
    const resp: protocol.Moment.Delete.Response = {
      year: timestamp.year().toString(10),
    };
    reply
      .type('application/json')
      .code(200)
      .send(resp);
  }
}
