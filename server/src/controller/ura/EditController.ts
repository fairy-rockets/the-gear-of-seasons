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
  async handle(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const date = parseMomentPath(req.url);
    const moment = await this.shelf.findMoment(date, 'all');
    if (moment === null) {
      return reply
        .type('text/plain;charset=UTF-8')
        .code(404)
        .send('Moment not found');
    }
    return reply
      .type('text/html;charset=UTF-8')
      .code(200)
      .send(this.template.render({
        title: moment.title,
        author: moment.author,
        date: formatMomentTime(moment.timestamp!!),
        text: moment.text,
        status: moment.status,
        tier: moment.tier,
        series: moment.series.join(', '),
        sensitive: !moment.sensitiveManual ? 'auto' : moment.sensitive ? 'true' : 'false',
        // 手で上書きしている間は、DB に自動の値が無いので計算する。
        autoSensitive: moment.sensitiveManual ? await this.shelf.computeSensitive(moment.text) : moment.sensitive,
      }));
  }
}
