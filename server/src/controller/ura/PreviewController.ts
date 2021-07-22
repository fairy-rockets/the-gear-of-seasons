import { FastifyReply, FastifyRequest } from 'fastify';
import * as protocol from 'lib/protocol';
import Shelf from '../../shelf/Shelf';
import Moment, {parseMomentTime} from '../../shelf/Moment';
import MomentRenderer from '../../renderer/MomentRenderer';
import dayjs from 'dayjs';

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
  async handle(req: FastifyRequest, reply: FastifyReply) {
    const raw = req.body as protocol.Moment.Save.Request;
    const moment: Moment = {
      timestamp: (raw.date !== null && raw.date.length > 0) ? parseMomentTime(raw.date) : undefined,
      title: raw.title,
      author: raw.author,
      text: raw.text,
    };
    reply
      .type('text/html')
      .code(200)
      .send(await this.renderer.render(moment));
  }
}