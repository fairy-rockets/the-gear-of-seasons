import Handlebars from 'handlebars';
import {FastifyReply, FastifyRequest} from 'fastify';

import Asset from '../../lib/Asset.js';
import {PageMeta, absoluteURL, kSiteTitle, pageTitle, summarizeMomentText} from '../../lib/meta.js';

import Shelf from '../../shelf/Shelf.js';
import { Moment, formatMomentPath, parseMomentPath } from '../../shelf/Moment.js';

export default class MomentController {
  private readonly shelf: Shelf;
  private readonly template: Handlebars.TemplateDelegate;
  private constructor(shelf: Shelf, template: Handlebars.TemplateDelegate) {
    this.shelf = shelf;
    this.template = template;
  }
  static async create(asset: Asset, shelf: Shelf): Promise<MomentController> {
    const src = await asset.loadString('templates/omote/index.hbs');
    const template = Handlebars.compile(src);
    return new MomentController(shelf, template);
  }
  async handle(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const date = parseMomentPath(req.url);
    const moment = await this.shelf.findMoment(date);
    if (moment === null) {
      return reply
        .type('text/plain;charset=UTF-8')
        .code(404)
        .send('Moment not found');
    }
    return reply
      .type('text/html;charset=UTF-8')
      .code(200)
      .send(this.template(await this.metaOf(moment)));
  }
  private async metaOf(moment: Moment): Promise<PageMeta> {
    const path = moment.timestamp !== undefined ? formatMomentPath(moment.timestamp) : '/';
    return {
      siteTitle: kSiteTitle,
      title: pageTitle(moment.title),
      description: MomentController.descriptionOf(moment),
      canonical: absoluteURL(path),
      ogType: 'article',
      ogImage: await this.ogImageOf(moment),
      publishedTime: moment.timestamp?.format(),
    };
  }
  // 絵だけで本文が無い moment が 857 件中 54 件ある。description が空だと
  // SNS カードも検索結果も情報ゼロになるので、タイトルと日付で埋める。
  private static descriptionOf(moment: Moment): string {
    const summary = summarizeMomentText(moment.text);
    if (summary !== '') {
      return summary;
    }
    const date = moment.timestamp !== undefined ? moment.timestamp.format('YYYY年M月D日') : '';
    return `「${moment.title}」— 妖精⊸ロケットの${date}のひとこま。`;
  }
  // 動画・音声の entity には medium が無く /entity/:id/medium が 404 になるので、
  // その場合は icon(256px) に落とす。
  private async ogImageOf(moment: Moment): Promise<string | undefined> {
    if (moment.iconID === undefined) {
      return undefined;
    }
    const entity = await this.shelf.findEntity(moment.iconID);
    if (entity === null) {
      return undefined;
    }
    if (entity.type === 'image') {
      return absoluteURL(`/entity/${entity.id}/medium`);
    }
    return absoluteURL(`/entity/${entity.id}/icon`);
  }
}
