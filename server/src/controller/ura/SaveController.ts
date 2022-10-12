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
  async handle(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const now = dayjs();
    const moment = await this.shelf.updateMoment(req.body as protocol.Moment.Save.Request);
    if (moment.timestamp === undefined) {
      return reply
        .type('plain/text;charset=UTF-8')
        .code(500)
        .send('No timestamp!');
    }
    const resp: protocol.Moment.Save.Response = {
      path: formatMomentPath(moment.timestamp),
      date: formatMomentTime(moment.timestamp),
      body: await this.renderer.render(now, moment),
    };
    return reply
      .type('application/json;charset=UTF-8')
      .code(200)
      .send(resp);
  }
}
