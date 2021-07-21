import { FastifyReply } from 'fastify';
import Handlebars from 'handlebars';
import Asset from 'lib/asset';
import UraTamplate from './UraTemplate';

export default class IndexController {
  readonly template: UraTamplate;
  private constructor(template: UraTamplate) {
    this.template = template;
  }
  static async create(asset: Asset): Promise<IndexController> {
    const template = await UraTamplate.create(asset, 'index.hbs');
    return new IndexController(template);
  }
  render(reply: FastifyReply) {
    reply.type('text/html').code(200).send(this.template.render({}));
  }
}
