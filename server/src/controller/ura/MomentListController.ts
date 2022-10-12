import {FastifyReply, FastifyRequest, RequestGenericInterface} from 'fastify';
import dayjs from 'dayjs';

import Asset from '../../lib/Asset.js';

import UraTemplate from './lib/UraTemplate.js';
import Shelf from '../../shelf/Shelf.js';
import {formatMomentPath} from '../../shelf/Moment.js';

export interface MomentListControllerInterface extends RequestGenericInterface {
  Params: {
    year: string,
  }
}

export default class MomentListController {
  private readonly shelf: Shelf;
  private readonly template: UraTemplate;
  private constructor(shelf: Shelf, template: UraTemplate) {
    this.shelf = shelf;
    this.template = template;
  }
  static async create(asset: Asset, shelf: Shelf): Promise<MomentListController> {
    const template = await UraTemplate.create(asset, 'moments.hbs');
    return new MomentListController(shelf, template);
  }
  async handle(_req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const req = _req as FastifyRequest<MomentListControllerInterface>;
    const year = parseInt(req.params.year, 10) || dayjs().year();
    const moments = (await this.shelf.findMomentSummariesInYear(year)).map((it) => {
      return {
        iconID: it.iconID || '',
        path: formatMomentPath(it.timestamp!!),
        title: it.title,
      };
    });
    return reply
      .type('text/html;charset=UTF-8')
      .code(200)
      .send(this.template.render({
        year: year,
        lastYear: year-1,
        nextYear: year+1,
        numMoments: moments.length,
        moments: moments,
      }));
  }
}
