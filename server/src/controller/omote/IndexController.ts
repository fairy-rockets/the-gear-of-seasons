import {FastifyReply, FastifyRequest} from 'fastify';
import Handlebars from 'handlebars';

import Asset from '../../lib/Asset.js';

export default class IndexController {
  readonly template: Handlebars.TemplateDelegate;
  private constructor(template: Handlebars.TemplateDelegate) {
    this.template = template;
  }
  static async create(asset: Asset): Promise<IndexController> {
    const src = await asset.loadString('templates/omote/index.hbs');
    const template = Handlebars.compile(src);
    return new IndexController(template);
  }
  async handle(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    return reply.code(200)
      .type('text/html;charset=UTF-8')
      .send(this.template({}));
  }
}
