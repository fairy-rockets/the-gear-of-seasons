import {FastifyReply, FastifyRequest, RequestGenericInterface} from 'fastify';
import dayjs from 'dayjs';

import * as protocol from '../../lib/protocol.js';

import Shelf from '../../shelf/Shelf.js';
import {formatMomentPath, formatMomentTime, MomentSummary} from '../../shelf/Moment.js';

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
  async handle(_req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const req = _req as FastifyRequest<RandomSelectionControllerInterface>;
    const size = parseInt(req.query.size, 10);
    const moments: MomentSummary[] = await this.shelf.findMomentSummariesByRandom(size);
    const results: protocol.Moment.Search.Response[] = [];
    const yearStarts: { [n: number]: dayjs.Dayjs } = {};
    const yearLengths: { [n: number]: number } = {};
    for (const m of moments) {
      if(m.iconID === undefined) {
        continue;
      }
      if(m.timestamp === undefined) {
        continue;
      }
      const year = m.timestamp.year();
      let start = yearStarts[year];
      if (start === undefined) {
        start = m.timestamp.startOf('year');
        yearStarts[year] = start;
      }
      let yearLength = yearLengths[year];
      if (yearLength === undefined) {
        const end = m.timestamp.endOf('year');
        yearLength = end.diff(start);
        yearLengths[year] = yearLength;
      }
      const angle = (m.timestamp.diff(start) / yearLength) * Math.PI * 2;
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
    return reply
      .code(200)
      .type('application/json')
      .send(results);
  }
}
