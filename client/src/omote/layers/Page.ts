import World from '../World'
import Layer from '../Layer';
import { mat4 } from 'gl-matrix';
import twemoji from 'twemoji';
import { kEmojiURLBase } from '../../constant';
import * as analytics from '../Analytics';

export default class Page extends Layer {

  private readonly contentWrapper_: HTMLDivElement;
  private readonly content_: HTMLDivElement;
  private readonly closeButton_: HTMLDivElement;
  private readonly closeButtonListener_: () => void;
  private readonly backdropListener_: () => void;
  // 本文が届いたか(取得に失敗したときも含む)。
  private loaded_: boolean;
  constructor(world: World, path: string, contentPromise: Promise<string>) {
    super(world, path);

    this.contentWrapper_ = document.createElement('div');
    this.contentWrapper_.classList.add('content-wrapper');
    this.element.appendChild(this.contentWrapper_);

    this.content_ = document.createElement('div');
    this.content_.classList.add('content');
    this.contentWrapper_.appendChild(this.content_);

    this.closeButton_ = document.createElement('div');
    this.closeButton_.classList.add('close-button');
    this.closeButton_.innerHTML = kCloseButtonSrc;
    this.contentWrapper_.appendChild(this.closeButton_);

    this.closeButtonListener_ = () => this.world.openTop('close_button');
    this.backdropListener_ = () => this.world.openTop('backdrop');
    this.loaded_ = false;

    // タッチでも確実に閉じられるよう click を使う(合成 click が発火する)。
    this.closeButton_.addEventListener('click', this.closeButtonListener_, false);

    contentPromise.then(this.onLoad_.bind(this), this.onError_.bind(this));
  }

  /** 本文を取る。HTTP のエラー(404 など)も失敗にして、onError_ に回す。 */
  static fetchBody(url: string): Promise<string> {
    return fetch(url).then(resp => {
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      return resp.text();
    });
  }

  render(time: number, matWorld: mat4) {
  }

  onLoad_(body: string) {
    // 文字列に対して parse すると、属性値(title="カエル🐸…" など)の絵文字まで
    // <img> に置換されてタグが壊れる。DOM に対して parse すればテキストノードだけが対象になる。
    this.content_.innerHTML = body;
    twemoji.parse(this.content_, { base: kEmojiURLBase });

    const contents = this.content_.getElementsByTagName('script');
    for(let i = 0; i < contents.length; ++i) {
      const src = contents[i];
      const dst = document.createElement('script');
      dst.textContent = src.textContent;
      dst.src = src.src;
      dst.async = src.async;
      const p = src.parentNode!;
      p.insertBefore(dst, src);
      p.removeChild(src);
    }

    // サーバが SSR した <title> と同じ形にすること(server/src/lib/meta.ts の pageTitle)。
    // TODO: 同じ組み立てをサーバとクライアントで二重に持っている。増えてきたら
    // protocol.ts のように共有する場所へ移すか考える。
    const titles = this.content_.getElementsByClassName("title");
    if(titles.length > 0) {
      this.title_ = `${titles[0].textContent ?? ""} :: the gear of seasons`;
    }

    this.setupFooter_();
    this.loaded_ = true;
    this.world.notifyLoaded(this);
  }

  // moment 本文の末尾に付く .moment-footer（無ければ何もしない。about-us 等はフッター無し）
  private setupFooter_() {
    const gearLink = this.content_.querySelector<HTMLAnchorElement>('.moment-footer-gear');
    if(gearLink) {
      gearLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        this.world.openTop('footer_gear');
      });
    }

    const prevLink = this.content_.querySelector<HTMLAnchorElement>('a.moment-footer-prev');
    if(prevLink) {
      prevLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        this.world.openLayer(prevLink.getAttribute('href')!, 'footer_prev');
      });
    }

    const nextLink = this.content_.querySelector<HTMLAnchorElement>('a.moment-footer-next');
    if(nextLink) {
      nextLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        this.world.openLayer(nextLink.getAttribute('href')!, 'footer_next');
      });
    }

    const links = this.content_.querySelector<HTMLElement>('.moment-footer-links');
    if(links) {
      for(const a of Array.from(links.querySelectorAll<HTMLAnchorElement>('a'))) {
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          this.world.openLayer(a.getAttribute('href')!, 'footer_link');
        });
      }
    }
  }

  onError_(err: any) {
    this.content_.innerHTML = `<h1>エラー！</h1>Error:<strong>${err}</strong>`;
    analytics.exception(`page_load_failed: ${this.path}`, false);
    this.loaded_ = true;
    this.world.notifyLoaded(this);
  }

  override get titleKnown(): boolean {
    return this.loaded_;
  }

  onAttached() {
    this.world.canvas.addEventListener('mouseup', this.backdropListener_, false);
  }

  onDetached() {
    this.world.canvas.removeEventListener('mouseup', this.backdropListener_, false);
  }

  /** @override */
  destroy() {
  }
}

const kHTMLSrc = `
<div class="content">
</div>
`;

// viewBox 基準にして、ボタンの大きさは .close-button の width/height で決める。
const kCloseButtonSrc = `
<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
  <rect
      x="0" y="0"
      width="100" height="100"
      rx="20" ry="20"
      style="fill:white;fill-opacity:0.7;" />
  <line stroke-linecap="round"
          x1="25" y1="25" x2="75" y2="75"
          stroke="rgba(0, 0, 0, 0.5)" stroke-width="14"/>
  <line stroke-linecap="round"
          x1="25" y1="75" x2="75" y2="25"
          stroke="rgba(0, 0, 0, 0.5)" stroke-width="14"/>
</svg>
`;
