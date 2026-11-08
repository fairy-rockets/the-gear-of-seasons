import {FastifyReply, FastifyRequest} from 'fastify';
import Handlebars from 'handlebars';

import Asset from '../../lib/Asset.js';
import {PageMeta, absoluteURL, kSiteTitle, pageTitle} from '../../lib/meta.js';
import { displayAlt } from '../../shelf/EntityAnnotation.js';
import Shelf from '../../shelf/Shelf.js';

// 静的な omote のページ。どれも同じ index.hbs のシェルを返すが、<head> だけが違う。
export type StaticPage = 'index' | 'about-us' | 'shop' | 'pickup';

// サイト共通の OGP 画像。「太陽と帽子とお月さま」(/2018/12/17/18:18:29/) の絵で、
// この entity はその moment の iconID そのもの。medium(長辺2048px)を使う。
// alt はこの entity の注釈から引き、注釈が無いときだけ題で埋める。
const kSiteImageID = '84c23994da70378209994c29880fd1ba';
const kSiteImage = absoluteURL(`/entity/${kSiteImageID}/medium`);
const kSiteImageAlt = '太陽と帽子とお月さま';

const kPages: { [key in StaticPage]: PageMeta } = {
  'index': {
    siteTitle: kSiteTitle,
    title: kSiteTitle,
    description: '妖精⊸ロケットの宵宮ナギが描いた絵と、日々のかけらを、季節の歯車にならべた場所です。回して、気になった灯りをのぞいてみてください。',
    canonical: absoluteURL('/'),
    ogType: 'website',
    ogImage: kSiteImage,
    ogImageAlt: kSiteImageAlt,
    publishedTime: undefined,
  },
  'about-us': {
    siteTitle: kSiteTitle,
    title: pageTitle('「妖精⊸ロケット」について'),
    description: '「妖精⊸ロケット」は、甚三紅もみじと宵宮ナギの二人で作っているウェブサイトです。サークル情報とお問い合わせ先。',
    canonical: absoluteURL('/about-us/'),
    ogType: 'website',
    ogImage: kSiteImage,
    ogImageAlt: kSiteImageAlt,
    publishedTime: undefined,
  },
  'shop': {
    siteTitle: kSiteTitle,
    title: pageTitle('お店'),
    description: '妖精⊸ロケットの絵やグッズが買えるお店の一覧。Booth・Creema・DLSite。',
    canonical: absoluteURL('/shop/'),
    ogType: 'website',
    ogImage: kSiteImage,
    ogImageAlt: kSiteImageAlt,
    publishedTime: undefined,
  },
  'pickup': {
    siteTitle: kSiteTitle,
    title: pageTitle('えらんだ絵'),
    description: '妖精⊸ロケットの宵宮ナギが描いた絵から、えらんだものを並べています。一見かわいくて、よく見るとすこし翳りのある、hexe（魔女）の世界。',
    canonical: absoluteURL('/pickup/'),
    ogType: 'website',
    ogImage: kSiteImage,
    ogImageAlt: kSiteImageAlt,
    publishedTime: undefined,
  },
};

export default class IndexController {
  readonly template: Handlebars.TemplateDelegate;
  private readonly shelf: Shelf;
  private constructor(template: Handlebars.TemplateDelegate, shelf: Shelf) {
    this.template = template;
    this.shelf = shelf;
  }
  static async create(asset: Asset, shelf: Shelf): Promise<IndexController> {
    const src = await asset.loadString('templates/omote/index.hbs');
    const template = Handlebars.compile(src);
    return new IndexController(template, shelf);
  }
  // ページごとに <head> が違うので、ハンドラを作る側でどのページかを決める。
  handlerOf(page: StaticPage): (req: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply> {
    const meta = kPages[page];
    return async (_req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      const ogImageAlt = displayAlt(await this.shelf.findEntityAnnotation(kSiteImageID)) ?? kSiteImageAlt;
      return reply.code(200)
        .type('text/html;charset=UTF-8')
        .send(this.template({ ...meta, ogImageAlt }));
    };
  }
}
