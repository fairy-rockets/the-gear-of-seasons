import {FastifyReply, FastifyRequest} from 'fastify';

import Asset from '../../lib/Asset.js';

import EditorTemplate from './lib/EditorTemplate.js';

export default class NewController {
  private readonly template: EditorTemplate;
  private constructor(template: EditorTemplate) {
    this.template = template;
  }
  static async create(asset: Asset): Promise<NewController> {
    const template = await EditorTemplate.create(asset);
    return new NewController(template);
  }
  async handle(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    return reply
      .type('text/html;charset=UTF-8')
      .code(200)
      .send(this.template.render({
        title: '',
        author: '',
        date: '',
        text: '',
      }));
  }
}
