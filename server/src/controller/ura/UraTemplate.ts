import Handlebars from 'handlebars';
import Asset from 'lib/asset';
import Config from '../../Config';

export default class UraTamplate<T = any> {
  private readonly hbs: typeof Handlebars;
  private readonly template: Handlebars.TemplateDelegate<T>;
  private constructor(hbs: typeof Handlebars, templ: Handlebars.TemplateDelegate) {
    this.hbs = hbs;
    this.template = templ;
  }
  static async create<T>(asset: Asset, contentFilepath: string): Promise<UraTamplate<T>> {
    const hbs = Handlebars.create();
    hbs.registerPartial('omote-url', hbs.compile(`//${Config.OmoteHost}/`));
    hbs.registerPartial('ura-url', hbs.compile(`//${Config.UraHost}/`));
    hbs.registerPartial('content', hbs.compile(await asset.loadString(`templates/ura/${contentFilepath}`)));
    const src = await asset.loadString('templates/ura/_main.hbs');
    const templ = hbs.compile<T>(src);
    return new UraTamplate<T>(hbs, templ);
  }
  render(data: T): string {
    return this.template(data);
  }
}