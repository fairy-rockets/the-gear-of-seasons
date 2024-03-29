import Handlebars from 'handlebars';
import {FastifyReply, FastifyRequest} from 'fastify';

import Asset from '../../lib/Asset.js';

import Shelf from '../../shelf/Shelf.js';
import { parseMomentPath } from '../../shelf/Moment.js';

export default class MomentController {
  private readonly shelf: Shelf;
  private readonly template: Handlebars.TemplateDelegate;
  private constructor(shelf: Shelf, template: Handlebars.TemplateDelegate) {
    this.shelf = shelf;
    this.template = template;
  }
  static async create(asset: Asset, shelf: Shelf): Promise<MomentController> {
    const src = await asset.loadString('templates/omote/index.hbs');
    const template = Handlebars.compile(src);
    return new MomentController(shelf, template);
  }
  async handle(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const date = parseMomentPath(req.url);
    const moment = await this.shelf.findMoment(date);
    if (moment === null) {
      return reply
        .type('text/plain;charset=UTF-8')
        .code(404)
        .send('Moment not found');
    }
    return reply
      .type('text/html')
      .code(200)
      .send(this.template({}));
  }
}
