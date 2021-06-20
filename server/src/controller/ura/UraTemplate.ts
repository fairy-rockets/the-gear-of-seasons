import Handlebars from 'handlebars';
import Asset from 'lib/asset';

export default class UraTamplate<T = any> {
  private readonly hbs: typeof Handlebars;
  private readonly templ: Handlebars.TemplateDelegate;
  private constructor(hbs: typeof Handlebars, templ: Handlebars.TemplateDelegate) {
    this.hbs = hbs;
    this.templ = templ;
  }
  static async create<T>(asset: Asset, contentFilepath: string): Promise<UraTamplate<T>> {
    const hbs = Handlebars.create();
    hbs.registerPartial('content', hbs.compile(await asset.loadString(`templates/ura/${contentFilepath}`)));
    const src = await asset.loadString('templates/ura/_main.hbs');
    const templ = hbs.compile(src);
    return new UraTamplate<T>(hbs, templ);
  }
  render(data: T): string {
    return this.templ(data);
  }

}