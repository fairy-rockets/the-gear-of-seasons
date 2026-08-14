import {FastifyReply, FastifyRequest} from 'fastify';

import {absoluteURL} from '../../lib/meta.js';
import Shelf from '../../shelf/Shelf.js';
import {formatMomentPath} from '../../shelf/Moment.js';

// 歯車のトップは 300 件をランダムに引くので、そこからのリンクだけでは全 moment が
// クロールされる保証がない。sitemap.xml で全件を明示する。
const kStaticPaths: string[] = [
  '/',
  '/about-us/',
  '/pickup/',
  '/shop/',
];

// 全件を毎回 DB から引かないための保持時間。moment の追加が反映されるまでの遅れでもある。
const kCacheDurationMs = 60 * 60 * 1000;

export default class SitemapController {
  private readonly shelf: Shelf;
  private cache: { body: string, expiresAt: number } | null;
  private constructor(shelf: Shelf) {
    this.shelf = shelf;
    this.cache = null;
  }
  static async create(shelf: Shelf): Promise<SitemapController> {
    return new SitemapController(shelf);
  }
  async handle(_req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const now = Date.now();
    if (this.cache === null || this.cache.expiresAt <= now) {
      this.cache = {
        body: await this.render(),
        expiresAt: now + kCacheDurationMs,
      };
    }
    return reply
      .code(200)
      .type('application/xml;charset=UTF-8')
      .send(this.cache.body);
  }
  private async render(): Promise<string> {
    const moments = await this.shelf.findAllMomentSummaries();
    const buff: string[] = [];
    buff.push('<?xml version="1.0" encoding="UTF-8"?>');
    buff.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    for (const path of kStaticPaths) {
      buff.push(`  <url><loc>${escapeXML(absoluteURL(path))}</loc></url>`);
    }
    for (const m of moments) {
      if (m.timestamp === undefined) {
        continue;
      }
      const loc = escapeXML(absoluteURL(formatMomentPath(m.timestamp)));
      const lastmod = m.timestamp.format('YYYY-MM-DD');
      buff.push(`  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`);
    }
    buff.push('</urlset>');
    return buff.join('\n');
  }
}

function escapeXML(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
