import {FastifyReply, FastifyRequest, RequestGenericInterface} from 'fastify';

import * as protocol from 'lib/protocol';

import Shelf from '../../shelf/Shelf';
import {formatMomentPath, formatMomentTime, MomentSummary} from '../../shelf/Moment';

export interface RandomSelectionControllerInterface extends RequestGenericInterface {
  Querystring: {
    size: string,
  }
}

export default class RandomSelectionController {
  private readonly shelf: Shelf;
  private constructor(shelf: Shelf) {
    this.shelf = shelf;
  }
  static async create(shelf: Shelf): Promise<RandomSelectionController> {
    return new RandomSelectionController(shelf);
  }
  async handle(req: FastifyRequest<RandomSelectionControllerInterface>, reply: FastifyReply) {
    const size = parseInt(req.query.size, 10);
    const moments: MomentSummary[] = await this.shelf.findMomentSummariesByRandom(size);
    const results: protocol.Moment.Search.Response[] = [];
    for (const m of moments) {
      if(m.iconID === undefined) {
        continue;
      }
      if(m.timestamp === undefined) {
        continue;
      }
      const start = m.timestamp.startOf('year');
      const end = m.timestamp.endOf('year');
      const angle = (m.timestamp.diff(start) / end.diff(start)) * Math.PI * 2;
      const p = formatMomentPath(m.timestamp);
      results.push({
        angle: angle,
        date: formatMomentTime(m.timestamp),
        title: m.title,
        path: p,
        imageURL: `/entity/${m.iconID}/icon`,
        bodyURL: `/moment${p}`,
      });
    }
    reply
      .type('application/json')
      .code(200)
      .send(results);
  }
}
