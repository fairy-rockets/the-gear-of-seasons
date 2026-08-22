import {FastifyReply, FastifyRequest} from 'fastify';

import {absoluteURL} from '../../lib/meta.js';

// omote: 全部クロールしてよい。ura は編集画面なので丸ごと拒否する。
//
// /moment/... や /moments/random を Disallow で塞がないこと。Google のレンダラは
// robots.txt をサブリソースの取得にも適用するので、塞ぐと本文もアイコンも取れなくなる。
// 断片が単体でインデックスされるのは X-Robots-Tag: noindex の方で止める。
const kOmote = `User-agent: *
Allow: /

Sitemap: ${absoluteURL('/sitemap.xml')}
`;

const kUra = `User-agent: *
Disallow: /
`;

export default class RobotsController {
  static async create(): Promise<RobotsController> {
    return new RobotsController();
  }
  async handleOmote(_req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    return this.send(reply, kOmote);
  }
  async handleUra(_req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    return this.send(reply, kUra);
  }
  private async send(reply: FastifyReply, body: string): Promise<FastifyReply> {
    return reply
      .code(200)
      .type('text/plain;charset=UTF-8')
      .send(body);
  }
}
