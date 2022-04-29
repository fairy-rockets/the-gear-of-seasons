import {FastifyReply, FastifyRequest} from 'fastify';

import Asset from '../../lib/Asset.js';

import EditorTemplate from './lib/EditorTemplate.js';
import Shelf from '../../shelf/Shelf.js';
import {parseMomentPath, formatMomentTime} from '../../shelf/Moment.js';

export default class EditController {
  private readonly shelf: Shelf;
  private readonly template: EditorTemplate;
  private constructor(shelf: Shelf, template: EditorTemplate) {
    this.shelf = shelf;
    this.template = template;
  }
  static async create(asset: Asset, shelf: Shelf): Promise<EditController> {
    const template = await EditorTemplate.create(asset);
    return new EditController(shelf, template);
  }
  async handle(req: FastifyRequest, reply: FastifyReply) {
    const date = parseMomentPath(req.url);
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
      .send(this.template.render({
        title: moment.title,
        author: moment.author,
        date: formatMomentTime(moment.timestamp!!),
        text: moment.text,
      }));
  }
}
