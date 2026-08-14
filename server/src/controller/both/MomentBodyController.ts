import {FastifyReply, FastifyRequest} from 'fastify';
import dayjs from 'dayjs';

import MomentRenderer from '../../renderer/MomentRenderer.js';
import Shelf from '../../shelf/Shelf.js';
import {parseMomentPath} from '../../shelf/Moment.js';

export default class MomentBodyController {
  private readonly shelf: Shelf;
  private readonly renderer: MomentRenderer;
  private constructor(shelf: Shelf) {
    this.shelf = shelf;
    this.renderer = new MomentRenderer(shelf);
  }
  static async create(shelf: Shelf): Promise<MomentBodyController> {
    return new MomentBodyController(shelf);
  }
  // omote: 本文＋「まえ/つぎ/歯車にもどる」フッター付き。
  async handleOmote(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    return this.render(req, reply, true);
  }
  // ura: 本文のみ。プレビュー等にフッターを混ぜない。
  async handleUra(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    return this.render(req, reply, false);
  }
  private async render(req: FastifyRequest, reply: FastifyReply, withFooter: boolean): Promise<FastifyReply> {
    const date = parseMomentPath(req.url.slice(7));
    const moment = await this.shelf.findMoment(date);
    if (moment === null) {
      return reply
        .type('text/plain;charset=UTF-8')
        .code(404)
        .send('Moment not found');
    }
    let body = await this.renderer.render(dayjs(), moment);
    if (withFooter) {
      const [prev, next] = await Promise.all([
        this.shelf.findPreviousMomentSummary(date),
        this.shelf.findNextMomentSummary(date),
      ]);
      body += MomentRenderer.renderNavigationFooter(prev, next);
    }
    return reply
      .type('text/html;charset=UTF-8')
      // 本文の断片(<html> も <title> も無い)なので、単体でインデックスされると
      // moment ページの薄い重複になる。クロールは許して索引だけ止める
      // (robots.txt で塞ぐと Google のレンダラが本文を取れなくなる)。
      .header('X-Robots-Tag', 'noindex')
      .code(200)
      .send(body);
  }
}
