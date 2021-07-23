import {FastifyReply, FastifyRequest} from 'fastify';

import Asset from 'lib/asset';

import UraTemplate from './lib/UraTemplate';

export default class IndexController {
  readonly template: UraTemplate;
  private constructor(template: UraTemplate) {
    this.template = template;
  }
  static async create(asset: Asset): Promise<IndexController> {
    const template = await UraTemplate.create(asset, 'index.hbs');
    return new IndexController(template);
  }
  async handle(req: FastifyRequest, reply: FastifyReply) {
    reply.type('text/html')
      .code(200)
      .send(this.template.render({}));
  }
}
