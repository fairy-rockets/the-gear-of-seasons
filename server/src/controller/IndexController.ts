import { FastifyReply } from 'fastify';
import Handlebars from 'handlebars';
import Asset from 'lib/asset';

export default class IndexController {
  readonly template: Handlebars.TemplateDelegate;
  private constructor(template: Handlebars.TemplateDelegate) {
    this.template = template;
  }
  static async create(asset: Asset): Promise<IndexController> {
    const src = await asset.loadString('templates/index.hbs');
    const templ = Handlebars.compile(src);
    return new IndexController(templ);
  }
  render(reply: FastifyReply) {
    reply.type('text/html').code(200).send(this.template({}));
  }
}
