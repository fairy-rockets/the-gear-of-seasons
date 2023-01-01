import {FastifyReply, FastifyRequest} from 'fastify';

import Asset from '../../lib/Asset.js';

import UraTemplate from './lib/UraTemplate.js';

export default class IndexController {
  readonly template: UraTemplate;
  private constructor(template: UraTemplate) {
    this.template = template;
  }
  static async create(asset: Asset): Promise<IndexController> {
    const template = await UraTemplate.create(asset, 'index.hbs');
    return new IndexController(template);
  }
  async handle(_req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    return reply
      .code(200)
      .type('text/html;charset=UTF-8')
      .send(this.template.render({}));
  }
}
