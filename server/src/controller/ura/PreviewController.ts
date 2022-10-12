import dayjs from 'dayjs';
import { FastifyReply, FastifyRequest } from 'fastify';

import * as protocol from '../../lib/protocol.js';

import Shelf from '../../shelf/Shelf.js';
import {Moment, parseMomentTime} from '../../shelf/Moment.js';
import MomentRenderer from '../../renderer/MomentRenderer.js';

export default class PreviewController {
  private readonly shelf: Shelf;
  private readonly renderer: MomentRenderer;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
    this.renderer = new MomentRenderer(this.shelf);
  }
  static async create(shelf: Shelf): Promise<PreviewController> {
    return new PreviewController(shelf);
  }
  async handle(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const raw = req.body as protocol.Moment.Save.Request;
    const now = dayjs();
    const moment: Moment = {
      timestamp: (raw.date !== null && raw.date.length > 0) ? parseMomentTime(raw.date) : undefined,
      title: raw.title,
      author: raw.author,
      text: raw.text,
      iconID: undefined,
    };
    return reply
      .type('text/html;charset=UTF-8')
      .code(200)
      .send(await this.renderer.render(now, moment));
  }
}