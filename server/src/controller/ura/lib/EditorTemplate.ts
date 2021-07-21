import UraTemplate from './UraTemplate';
import Asset from 'lib/dist/asset';
import { MomentData } from 'lib/dist/gear';

export default class EditorTemplate {
  private readonly template: UraTemplate<MomentData>;
  constructor(template: UraTemplate) {
    this.template = template;
  }
  static async create(asset: Asset): Promise<EditorTemplate> {
    const template = await UraTemplate.create<MomentData>(asset, 'edit.hbs');
    return new EditorTemplate(template);
  }
  render(data: MomentData): string {
    return this.template.render(data);
  }
}
