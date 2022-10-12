import { FastifyReply, FastifyRequest } from 'fastify';

import * as protocol from '../../lib/protocol.js'

import Shelf from '../../shelf/Shelf.js';
import { parseMomentTime } from '../../shelf/Moment.js';
import MomentRenderer from '../../renderer/MomentRenderer.js';

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
  async handle(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const r = req.body as protocol.Moment.Delete.Request;
    const timestamp = parseMomentTime(r.date)
    const result = await this.shelf.deleteMoment(timestamp);
    if (!result) {
      return reply
        .type('plain/text;charset=UTF-8')
        .code(500)
        .send('Moment not found!');
    }
    const resp: protocol.Moment.Delete.Response = {
      year: timestamp.year().toString(10),
    };
    return reply
      .type('application/json;charset=UTF-8')
      .code(200)
      .send(resp);
  }
}
