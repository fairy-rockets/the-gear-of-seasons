import {escapeHTML} from '@wordpress/escape-html';
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
    const entries: SitemapEntry[] = kStaticPaths.map((path) => ({
      loc: absoluteURL(path),
    }));
    for (const m of moments) {
      if (m.timestamp === undefined) {
        continue;
      }
      entries.push({
        loc: absoluteURL(formatMomentPath(m.timestamp)),
        lastmod: m.timestamp.format('YYYY-MM-DD'),
      });
    }
    return renderSitemapXML(entries);
  }
}

export type SitemapEntry = {
  loc: string,
  lastmod?: string,
};

/**
 * sitemap.xml を組む。DB を触らない純関数。
 *
 * <loc> と <lastmod> は XML の文字データなので、エスケープが必要なのは
 * `<` と `&` だけ(XML 1.0 §2.4。`>` は "]]>" の並びの中だけが必須で、
 * ここでは現れない)。それがちょうど escapeHTML の仕事なので、
 * MomentRenderer と同じ @wordpress/escape-html を使う。
 *
 * そもそも今の入力は Config.OmoteOrigin + kStaticPaths か
 * formatMomentPath() の '/YYYY/MM/DD/HH:mm:ss/' で、[0-9/:a-z-] しか
 * 含まないため実際には何も置換されない。loc の作り方が変わったときの
 * 保険として通してある。
 */
export function renderSitemapXML(entries: SitemapEntry[]): string {
  const buff: string[] = [];
  buff.push('<?xml version="1.0" encoding="UTF-8"?>');
  buff.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  for (const entry of entries) {
    const loc = `<loc>${escapeHTML(entry.loc)}</loc>`;
    const lastmod = entry.lastmod !== undefined
      ? `<lastmod>${escapeHTML(entry.lastmod)}</lastmod>`
      : '';
    buff.push(`  <url>${loc}${lastmod}</url>`);
  }
  buff.push('</urlset>');
  return buff.join('\n');
}
