import dayjs from 'dayjs';
import { FastifyReply, FastifyRequest } from 'fastify';

import * as protocol from '../../lib/protocol.js';

import Shelf from '../../shelf/Shelf.js';
import {formatMomentPath, formatMomentTime} from '../../shelf/Moment.js';
import MomentRenderer from '../../renderer/MomentRenderer.js';

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
    const now = dayjs();
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
      body: await this.renderer.render(now, moment),
    };
    reply
      .type('application/json')
      .code(200)
      .send(resp);
  }
}
