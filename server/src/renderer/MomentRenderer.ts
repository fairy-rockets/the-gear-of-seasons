import {escapeAttribute, escapeHTML} from '@wordpress/escape-html';
import axios, { ResponseType } from 'axios';
import {marked} from 'marked';
import dayjs from 'dayjs';

import * as fml from '../lib/fml.js';
import { externalVideoPresentation } from '../lib/ExternalVideoRef.js';

import Shelf from '../shelf/Shelf.js';
import { ExternalVideoEntity } from '../shelf/Entity.js';
import { EntityAnnotation } from '../shelf/EntityAnnotation.js';
import { Moment, MomentSummary, formatMomentPath } from '../shelf/Moment.js';

class MomentRenderer {
  private readonly shelf: Shelf;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
  }
  // DBを触らない純関数。moment ページ下部の「まえ/つぎ/歯車にもどる」＋動線リンクを組み立てる。
  static renderNavigationFooter(prev: MomentSummary | null, next: MomentSummary | null): string {
    const prevLink = (prev !== null && prev.timestamp !== undefined)
      ? `<a class="moment-footer-prev" href="${escapeAttribute(formatMomentPath(prev.timestamp))}" title="${escapeAttribute(prev.title)}">← まえの絵</a>`
      : `<span class="moment-footer-prev disabled">← まえの絵</span>`;
    const nextLink = (next !== null && next.timestamp !== undefined)
      ? `<a class="moment-footer-next" href="${escapeAttribute(formatMomentPath(next.timestamp))}" title="${escapeAttribute(next.title)}">つぎの絵 →</a>`
      : `<span class="moment-footer-next disabled">つぎの絵 →</span>`;
    return `
<hr>
<div class="moment-footer">
  <nav class="moment-footer-nav">
    ${prevLink}
    <a class="moment-footer-gear" href="/">歯車にもどる</a>
    ${nextLink}
  </nav>
  <nav class="moment-footer-links">
    <a href="/pickup/">🏮 えらんだ絵をみる</a>
    <span class="moment-footer-sep">・</span>
    <a href="/shop/">お店</a>
  </nav>
</div>
`.trim();
  }
  async render(now: dayjs.Dayjs, moment: Moment): Promise<string> {
    const buff: string[] = [];
    const doc = fml.parse(moment.text);
    const imageIDs = [...new Set(doc.blocks
      .filter((block): block is fml.Image => block.type === 'image' && block.entity !== undefined)
      .map((block) => block.entity!))];
    const annotations = imageIDs.length > 0
      ? await this.shelf.findEntityAnnotations(imageIDs)
      : new Map<string, EntityAnnotation>();
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
          buff.push(await this.renderImage(block, annotations.get(block.entity ?? '')));
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
  // メディアの要素には data-entity（entity の id）と data-type（種類）を付ける。ura の編集画面が、
  // プレビューのメディアから注釈の引き出しを開くのに使う。
  private async renderImage(block: fml.Image, annotation: EntityAnnotation | undefined): Promise<string> {
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
    const alt = annotation !== undefined && annotation.alt !== null && annotation.alt.trim() !== ''
      ? annotation.alt
      : 'an image.';
    const img = `<img class="embed" src="/entity/${escapeAttribute(block.entity)}/medium" width="${width}" height="${height}" alt="${escapeAttribute(alt)}" data-entity="${escapeAttribute(entity.id)}" data-type="image">`;
    // 元画像は表示にもリンクにも使わない。entity の元ファイルへのリンクは [link] ブロックで貼れる。
    if (!block.link) {
      return img;
    }
    return `
<a href="${escapeAttribute(block.link)}" target="_blank" rel="noopener noreferrer">
  ${img}
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
    switch (entity.location) {
      case 'internal':
        return `
<video class="embed" preload="metadata" loop controls="controls" width="${entity.width}" height="${entity.height}" data-entity="${escapeAttribute(entity.id)}" data-type="video">
  <source type="${escapeAttribute(entity.mimeType)}" src="/entity/${escapeAttribute(entity.id)}">
  <a href="/entity/${escapeAttribute(entity.id)}">Click to play.</a>
</video>
`.trim();
      case 'external':
        return MomentRenderer.renderExternalVideo(entity);
    }
  }
  // 外部（今は YouTube だけ）の動画は埋め込みのプレイヤーで見せる。縦横比は entity の埋め込みの大きさから取り、
  // 幅は埋め込みの大きさを上限に、本文の幅に合わせる（Shorts は縦長に出る）。
  private static renderExternalVideo(entity: ExternalVideoEntity): string {
    const style = `aspect-ratio: ${entity.width} / ${entity.height}; max-width: ${entity.width}px;`;
    const { embedURL, playerTitle } = externalVideoPresentation(entity.externalRef);
    return `
<iframe class="embed external ${escapeAttribute(entity.externalRef.platform)}" src="${escapeAttribute(embedURL)}" style="${escapeAttribute(style)}" title="${escapeAttribute(playerTitle)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" data-entity="${escapeAttribute(entity.id)}" data-type="video"></iframe>
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
<audio class="embed" class="" src="/entity/${escapeAttribute(entity.id)}" title="" controls="controls" data-entity="${escapeAttribute(entity.id)}" data-type="audio"></audio>
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
      text =
        await axios.get<string>(block.url, {
          responseType: <ResponseType> 'text',
        })
        .then((r) => r.data);
    } catch (e) {
      const err = e as Error;
      return `<p>!!Failed to fetch markdown: ${escapeHTML(err.toString())}!!</p>`
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
