import {FastifyReply, FastifyRequest} from 'fastify';
import Handlebars from 'handlebars';

import Asset from '../../lib/Asset.js';
import {PageMeta, absoluteURL, kSiteTitle, pageTitle} from '../../lib/meta.js';

// 静的な omote のページ。どれも同じ index.hbs のシェルを返すが、<head> だけが違う。
export type StaticPage = 'index' | 'about-us' | 'shop' | 'pickup';

const kSiteImage = absoluteURL('/static/kaede.jpg');

const kPages: { [key in StaticPage]: PageMeta } = {
  'index': {
    siteTitle: kSiteTitle,
    title: kSiteTitle,
    description: '妖精⊸ロケットの宵宮ナギが描いた絵と、日々のかけらを、季節の歯車にならべた場所です。回して、気になった灯りをのぞいてみてください。',
    canonical: absoluteURL('/'),
    ogType: 'website',
    ogImage: kSiteImage,
    publishedTime: undefined,
  },
  'about-us': {
    siteTitle: kSiteTitle,
    title: pageTitle('「妖精⊸ロケット」について'),
    description: '「妖精⊸ロケット」は、甚三紅もみじと宵宮ナギの二人で作っているウェブサイトです。サークル情報とお問い合わせ先。',
    canonical: absoluteURL('/about-us/'),
    ogType: 'website',
    ogImage: kSiteImage,
    publishedTime: undefined,
  },
  'shop': {
    siteTitle: kSiteTitle,
    title: pageTitle('お店'),
    description: '妖精⊸ロケットの絵やグッズが買えるお店の一覧。Booth・Creema・DLSite。',
    canonical: absoluteURL('/shop/'),
    ogType: 'website',
    ogImage: kSiteImage,
    publishedTime: undefined,
  },
  'pickup': {
    siteTitle: kSiteTitle,
    title: pageTitle('えらんだ絵'),
    description: '妖精⊸ロケットの宵宮ナギが描いた絵から、えらんだものを並べています。一見かわいくて、よく見るとすこし翳りのある、hexe（魔女）の世界。',
    canonical: absoluteURL('/pickup/'),
    ogType: 'website',
    ogImage: kSiteImage,
    publishedTime: undefined,
  },
};

export default class IndexController {
  readonly template: Handlebars.TemplateDelegate;
  private constructor(template: Handlebars.TemplateDelegate) {
    this.template = template;
  }
  static async create(asset: Asset): Promise<IndexController> {
    const src = await asset.loadString('templates/omote/index.hbs');
    const template = Handlebars.compile(src);
    return new IndexController(template);
  }
  // ページごとに <head> が違うので、ハンドラを作る側でどのページかを決める。
  handlerOf(page: StaticPage): (req: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply> {
    const meta = kPages[page];
    return async (_req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      return reply.code(200)
        .type('text/html;charset=UTF-8')
        .send(this.template(meta));
    };
  }
}
