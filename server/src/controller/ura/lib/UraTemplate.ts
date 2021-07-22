import Handlebars, {Template} from 'handlebars';
import Asset from 'lib/asset';
import Config from '../../../Config';
import dayjs from "dayjs";

export default class UraTemplate<T = any> {
  private readonly hbs: typeof Handlebars;
  private readonly template: Handlebars.TemplateDelegate<T>;
  private constructor(hbs: typeof Handlebars, templ: Handlebars.TemplateDelegate) {
    this.hbs = hbs;
    this.template = templ;
  }
  static async create<T>(asset: Asset, contentFilepath: string): Promise<UraTemplate<T>> {
    const hbs = Handlebars.create();
    hbs.registerPartial('omote-url', hbs.compile(`//${Config.OmoteHost}/`));
    hbs.registerPartial('ura-url', hbs.compile(`//${Config.UraHost}/`));
    hbs.registerPartial('content', hbs.compile(await asset.loadString(`templates/ura/${contentFilepath}`)));
    hbs.registerPartial('currentYear', hbs.compile(`${dayjs().year()}`));
    hbs.registerHelper('eq', function (arg1: any, arg2: any):boolean {
      return arg1 === arg2;
    })
    const src = await asset.loadString('templates/ura/_main.hbs');
    const template = hbs.compile<T>(src);
    return new UraTemplate<T>(hbs, template);
  }
  registerPartial(name: string, fn: Template): UraTemplate<T> {
    this.hbs.registerPartial(name, fn);
    return this;
  }
  registerString(name: string, content: string): UraTemplate<T> {
    this.hbs.registerPartial(name, this.hbs.compile(content));
    return this;
  }
  registerHelper(name: string, fn: Handlebars.HelperDelegate): UraTemplate<T> {
    this.hbs.registerHelper(name, fn);
    return this;
  }
  render(data: T): string {
    return this.template(data);
  }
}