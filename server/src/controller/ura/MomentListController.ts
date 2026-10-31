import {FastifyReply, FastifyRequest} from 'fastify';

import Asset from '../../lib/Asset.js';

import UraTemplate from './lib/UraTemplate.js';
import Shelf from '../../shelf/Shelf.js';

// /moments/。下書きも含めた全件の要約を JSON でページに埋め込み、絞り込みはブラウザ（client/src/ura/moments/）でする。
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
    const items = await this.shelf.findMomentListItems('all');
    return reply
      .type('text/html;charset=UTF-8')
      .code(200)
      .send(this.template.render({
        items: embedJSON(items),
      }));
  }
}

// <script type="application/json"> の中に書く JSON。本文に </script> や <!-- があっても要素が閉じないよう、< をエスケープする。
export function embedJSON(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
