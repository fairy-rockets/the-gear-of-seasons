import Shelf from '../shelf/Shelf';
import * as fml from 'lib/fml';
import {escapeAttribute, escapeHTML} from "@wordpress/escape-html";
import Moment from '../shelf/Moment';

class MomentRenderer {
  private readonly shelf: Shelf;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
  }
  async render(moment: Moment): Promise<string> {
    const buff: string[] = [];
    const doc = fml.parse(moment.text);
    buff.push(`
<div class="moment-info">
  <h1 class="moment-title title">${escapeHTML(moment.title)}</h1>
  <span class="moment-date"></span>
  <span class="moment-author">${escapeHTML(moment.author)}</span>
</div>
`.trim());
    buff.push('<hr>')
    for (const block of doc.blocks) {
      switch (block.type) {
        case 'image':
          buff.push(await this.renderImage(block));
          break;
        case 'text':
          buff.push(`<p>${escapeHTML(block.text)}</p>`);
          break;
      }
    }
    return buff.join('');
  }
  private async renderImage(image: fml.Image): Promise<string> {
    if (image.entity === undefined) {
      return `<p>!!Image not set!!</p>`
    }
    const entity = await this.shelf.findEntity(image.entity);
    if (entity === null) {
      return `<p>!!Image id =${escapeHTML(image.entity)} not found!!</p>`
    }
    if (entity.type !== 'image') {
      return `<p>!!id =${escapeHTML(image.entity)} is not an image!!</p>`
    }
    let width: number;
    let height: number;
    if (entity.width > entity.height) {
      width = Math.min(2048, entity.width);
      height = entity.height * width / entity.width;
    } else {
      height = Math.min(2048, entity.height);
      width = entity.width * height / entity.height;
    }
    return `
<a href="/entity/${escapeAttribute(image.entity)}" target="_blank" rel="noopener noreferrer">
  <img class="embed" src="/entity/${escapeAttribute(image.entity)}/medium" width="${width}" height="${height}" alt="No alt">
</a>
`;
  }
}

export default MomentRenderer;
