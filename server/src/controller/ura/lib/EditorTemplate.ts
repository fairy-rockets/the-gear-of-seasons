import Asset from 'lib/asset';

import UraTemplate from './UraTemplate';

type EditorData = {
  title: string;
  author: string;
  date: string;
  text: string;
};

class EditorTemplate {
  private readonly template: UraTemplate<EditorData>;
  constructor(template: UraTemplate) {
    this.template = template;
  }
  static async create(asset: Asset): Promise<EditorTemplate> {
    const template = await UraTemplate.create<EditorData>(asset, 'edit.hbs');
    return new EditorTemplate(template);
  }
  render(data: EditorData): string {
    return this.template.render(data);
  }
}

export default EditorTemplate;
export {
  EditorData,
};
