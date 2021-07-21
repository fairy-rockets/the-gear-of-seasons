import { FastifyReply } from 'fastify';
import Asset from 'lib/asset';
import EditorTemplate from './lib/EditorTemplate';

export default class NewController {
  readonly template: EditorTemplate;
  private constructor(template: EditorTemplate) {
    this.template = template;
  }
  static async create(asset: Asset): Promise<NewController> {
    const template = await EditorTemplate.create(asset);
    return new NewController(template);
  }
  render(reply: FastifyReply) {
    reply
      .type('text/html')
      .code(200)
      .send(this.template.render({
        title: '',
        author: '',
        date: '',
        text: '',
      }));
  }
}
