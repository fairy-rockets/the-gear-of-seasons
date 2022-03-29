import Handlebars, {Template} from 'handlebars';
import dayjs from 'dayjs';

import Asset from 'lib/asset';

import Config from '../../../Config.js';

const kCompileOption: CompileOptions = {
  preventIndent: true,
};

export default class UraTemplate<T = any> {
  private readonly hbs: typeof Handlebars;
  private readonly template: Handlebars.TemplateDelegate<T>;
  private constructor(hbs: typeof Handlebars, templ: Handlebars.TemplateDelegate) {
    this.hbs = hbs;
    this.template = templ;
  }
  static async create<T>(asset: Asset, contentFilepath: string): Promise<UraTemplate<T>> {
    const hbs = Handlebars.create();
    hbs.registerPartial('omote-url', hbs.compile(`//${Config.OmoteHost}/`, kCompileOption));
    hbs.registerPartial('ura-url', hbs.compile(`//${Config.UraHost}/`, kCompileOption));
    hbs.registerPartial('content', hbs.compile(await asset.loadString(`templates/ura/${contentFilepath}`), kCompileOption));
    hbs.registerPartial('currentYear', hbs.compile(`${dayjs().year()}`, kCompileOption));
    hbs.registerHelper('eq', function (arg1: any, arg2: any):boolean {
      return arg1 === arg2;
    })
    const src = await asset.loadString('templates/ura/_main.hbs');
    const template = hbs.compile<T>(src, kCompileOption);
    return new UraTemplate<T>(hbs, template);
  }
  registerPartial(name: string, fn: Template): UraTemplate<T> {
    this.hbs.registerPartial(name, fn);
    return this;
  }
  registerString(name: string, content: string): UraTemplate<T> {
    this.hbs.registerPartial(name, this.hbs.compile(content, kCompileOption));
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