import {escapeAttribute, escapeHTML} from "@wordpress/escape-html";
import fetch from 'node-fetch';
import marked from 'marked';
import dayjs from 'dayjs';

import * as fml from 'lib/fml';

import Shelf from '../shelf/Shelf';
import { Moment } from '../shelf/Moment';

class MomentRenderer {
  private readonly shelf: Shelf;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
  }
  async render(now: dayjs.Dayjs, moment: Moment): Promise<string> {
    const buff: string[] = [];
    const doc = fml.parse(moment.text);
    buff.push(`
<div class="moment-info">
  <h1 class="moment-title title">${escapeHTML(moment.title)}</h1>
  <span class="moment-date">${escapeHTML(renderTime(moment.timestamp, now))}</span>
  <span class="moment-author">${escapeHTML(moment.author)}</span>
</div>
`.trim());
    buff.push('<hr>')
    for (const block of doc.blocks) {
      switch (block.type) {
        case 'text':
          buff.push(`<p>${block.text}</p>`);
          break;
        case 'image':
          buff.push(await this.renderImage(block));
          break;
        case 'video':
          buff.push(await this.renderVideo(block));
          break;
        case 'audio':
          buff.push(await this.renderAudio(block));
          break;
        case 'link':
          buff.push(MomentRenderer.renderLink(block));
          break;
        case 'markdown':
          buff.push(await MomentRenderer.renderMarkdown(block));
          break;
      }
    }
    return buff.join('');
  }
  private async renderImage(block: fml.Image): Promise<string> {
    if (block.entity === undefined) {
      return `<p>!!Image not set!!</p>`
    }
    const entity = await this.shelf.findEntity(block.entity);
    if (entity === null) {
      return `<p>!!Image id=${escapeHTML(block.entity)} not found!!</p>`
    }
    if (entity.type !== 'image') {
      return `<p>!!id=${escapeHTML(block.entity)} is not an image!!</p>`
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
<a href="/entity/${escapeAttribute(block.entity)}" target="_blank" rel="noopener noreferrer">
  <img class="embed" src="/entity/${escapeAttribute(block.entity)}/medium" width="${width}" height="${height}" alt="an image.">
</a>
`.trim();
  }
  private async renderVideo(block: fml.Video) {
    if (block.entity === undefined) {
      return `<p>!!Video not set!!</p>`
    }
    const entity = await this.shelf.findEntity(block.entity);
    if (entity === null) {
      return `<p>!!Video id=${escapeHTML(block.entity)} not found!!</p>`
    }
    if (entity.type !== 'video') {
      return `<p>!!id=${escapeHTML(block.entity)} is not a video!!</p>`
    }
    return `
<video class="embed" preload="metadata" controls="controls" width="${entity.width}" height="${entity.height}">
  <source type="${escapeAttribute(entity.mimeType)}" src="/entity/${escapeAttribute(entity.id)}">
  <a href="/entity/${escapeAttribute(entity.id)}">Click to play.</a>
</video>
`.trim();
  }
  private async renderAudio(block: fml.Audio) {
    if (block.entity === undefined) {
      return `<p>!!Audio not set!!</p>`
    }
    const entity = await this.shelf.findEntity(block.entity);
    if (entity === null) {
      return `<p>!!Audio id=${escapeHTML(block.entity)} not found!!</p>`
    }
    if (entity.type !== 'audio') {
      return `<p>!!id=${escapeHTML(block.entity)} is not an audio!!</p>`
    }
    return `
<audio class="embed" class="" src="/entity/${escapeAttribute(entity.id)}" title="" controls="controls"></audio>
`.trim();
  }
  private static renderLink(block: fml.Link): string {
    if (block.entity === undefined) {
      return `<p>!!Link not set!!</p>`
    }
    return `
<a href="/entity/${escapeAttribute(block.entity)}" target="_blank" rel="noopener noreferrer">${escapeHTML(block.text || block.entity)}</a>
`;
  }
  private static async renderMarkdown(block: fml.Markdown): Promise<string> {
    if (block.url === undefined) {
      return `<p>!!Markdown not set!!</p>`
    }
    let text: string;
    try {
      text = await fetch(block.url).then((res:any) => res.text());
    } catch (e) {
      return `<p>!!Failed to fetch markdown: ${escapeHTML(e.toString())}!!</p>`
    }
    return marked(text);
  }
}

function renderTime(time: dayjs.Dayjs | undefined, now: dayjs.Dayjs): string {
  if (time === undefined || time.isAfter(now)) {
    return 'わかんない！';
  }
  const diff = time.diff(now, 'year', true);
  const a = Math.trunc(diff);
  const b = Math.trunc((diff-a)*4);
  if (a === 0 && b === 0) {
    return `さいきん！`;
  } else if (b === 0) {
    return `季節の歯車を${-a}回巻き戻したころ`;
  } else if (a === 0) {
    return `季節が${-b}つ巡るまえ`;
  } else {
    return `季節の歯車を${-a}回巻き戻して、さらに季節が${-b}つ巡るまえ`;
  }
}

export default MomentRenderer;
