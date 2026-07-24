import Handlebars from 'handlebars';
import {FastifyReply, FastifyRequest} from 'fastify';
import dayjs from 'dayjs';

import Asset from '../../lib/Asset.js';
import Shelf from '../../shelf/Shelf.js';
import {formatMomentPath} from '../../shelf/Moment.js';

// えらんだ絵（代表作）。差し替えるときはこの配列を編集する。
const kPickupMoments: string[] = [
  '2024-11-14T13:18:23+09:00', // 塔の上で星を編む
  '2024-11-20T22:23:01+09:00', // 日々のくらし
  '2024-09-23T10:02:36+09:00', // ソラ
  '2022-12-30T10:21:47+09:00', // おやすみなさい
  '2022-12-24T19:09:58+09:00', // 狐の顧問
  '2022-06-08T00:43:14+09:00', // ずっと、守り続けてきた
  '2021-07-03T13:34:25+09:00', // 夕暮れを見ていた
  '2020-11-21T04:08:11+09:00', // 海の底のバス停にて
];

export default class PickupController {
  private readonly shelf: Shelf;
  private readonly template: Handlebars.TemplateDelegate;
  private constructor(shelf: Shelf, template: Handlebars.TemplateDelegate) {
    this.shelf = shelf;
    this.template = template;
  }
  static async create(asset: Asset, shelf: Shelf): Promise<PickupController> {
    const src = await asset.loadString('templates/omote/pickup.hbs');
    const template = Handlebars.compile(src);
    return new PickupController(shelf, template);
  }
  async handleBody(_req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const found = await Promise.all(kPickupMoments.map(async (ts) => {
      const moment = await this.shelf.findMoment(dayjs(ts));
      if (moment === null || moment.timestamp === undefined || moment.iconID === undefined) {
        return null;
      }
      return {
        path: formatMomentPath(moment.timestamp),
        title: moment.title,
        imageURL: `/entity/${moment.iconID}/icon`,
      };
    }));
    const moments = found.filter((m): m is NonNullable<typeof m> => m !== null);
    return reply
      .code(200)
      .type('text/html;charset=UTF-8')
      .send(this.template({moments}));
  }
}
