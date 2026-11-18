import Handlebars from 'handlebars';

import Asset from '../../../lib/Asset.js';
import { PageMeta } from '../../../lib/meta.js';
import kConfig from '../../../Config.js';

type ShellData = PageMeta & {
  gaMeasurementID: string | null;
};

/**
 * omote のシェル(templates/omote/index.hbs)。どの URL に直接来ても、このシェルが main.js を読み込み、
 * 本文は SPA が取りに行く。シェルは誰に対しても同じ中身で、違うのはページごとの <head> だけ。
 *
 * omote のページを足すときも、シェルはこのクラスで描くこと。
 * index.hbs を自前で compile すると、Google tag の設定(測定 ID)を渡し忘れても型で気づけない。
 */
export default class OmoteTemplate {
  private readonly template: Handlebars.TemplateDelegate<ShellData>;
  private readonly gaMeasurementID: string | null;
  private constructor(template: Handlebars.TemplateDelegate<ShellData>, gaMeasurementID: string | null) {
    this.template = template;
    this.gaMeasurementID = gaMeasurementID;
  }
  static async create(asset: Asset, gaMeasurementID: string | null = kConfig.gaMeasurementID): Promise<OmoteTemplate> {
    const src = await asset.loadString('templates/omote/index.hbs');
    return new OmoteTemplate(Handlebars.compile<ShellData>(src), gaMeasurementID);
  }
  render(meta: PageMeta): string {
    return this.template({ ...meta, gaMeasurementID: this.gaMeasurementID });
  }
}
