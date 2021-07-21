import { FastifyReply } from 'fastify';
import Asset from 'lib/asset';
import EditorTemplate from './lib/EditorTemplate';

export default class IndexController {
  readonly template: EditorTemplate;
  private constructor(template: EditorTemplate) {
    this.template = template;
  }
  static async create(asset: Asset): Promise<IndexController> {
    const template = await EditorTemplate.create(asset);
    return new IndexController(template);
  }
  render(reply: FastifyReply) {
    reply.type('text/html').code(200).send(this.template.render({}));
  }
}
