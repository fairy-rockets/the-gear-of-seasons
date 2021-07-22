import {FastifyReply, FastifyRequest, RequestGenericInterface} from 'fastify';
import Asset from 'lib/asset';
import UraTemplate from './lib/UraTemplate';
import Shelf from '../../shelf/Shelf';
import dayjs from "dayjs";
import {formatMomentPath} from '../../shelf/Moment';

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
  async handle(req: FastifyRequest<MomentListControllerInterface>, reply: FastifyReply) {
    const year = parseInt(req.params.year, 10) || dayjs().year();
    const moments = (await this.shelf.findMomentsInYear(year)).map((it) => {
      return {
        iconID: it.iconID || '',
        path: formatMomentPath(it.timestamp!!),
        title: it.title,
      };
    });
    reply.type('text/html')
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