import World from '../World'
import Layer from '../Layer';
import { mat4 } from 'gl-matrix';
import twemoji from 'twemoji';
import { EMOJI_URL_BASE } from '../../constant';

export default class Page extends Layer {

  private readonly contentWrapper_: HTMLDivElement;
  private readonly content_: HTMLDivElement;
  private readonly backButton_: HTMLDivElement;
  private readonly closeListener_: () => void;
  private prevTitle_: string;
  private title_: string;
  constructor(world: World, path: string, contentPromise: Promise<string>) {
    super(world, path);

    this.contentWrapper_ = document.createElement('div');
    this.contentWrapper_.classList.add('content-wrapper');
    this.element.appendChild(this.contentWrapper_);

    this.content_ = document.createElement('div');
    this.content_.classList.add('content');
    this.contentWrapper_.appendChild(this.content_);

    this.backButton_ = document.createElement('div');
    this.backButton_.classList.add('back-button');
    this.backButton_.innerHTML = backButtonSrc;
    this.contentWrapper_.appendChild(this.backButton_);

    this.closeListener_ = this.onClose_.bind(this);
    this.prevTitle_ = "";
    this.title_ = "";

    // タッチでも確実に閉じられるよう click を使う(合成 click が発火する)。
    this.backButton_.addEventListener('click', this.closeListener_, false);

    contentPromise.then(this.onLoad_.bind(this), this.onError_.bind(this));
  }

  render(time: number, matWorld: mat4) {
  }

  onLoad_(body: string) {
    this.content_.innerHTML = twemoji.parse(body, { base: EMOJI_URL_BASE });

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

    this.prevTitle_ = document.title;
    const titles = this.content_.getElementsByClassName("title");
    if(titles.length > 0) {
      this.title_ = titles[0].textContent ?? "";
      document.title = `${this.title_} :: the gear of seasons`;
    }

    this.setupFooter_();
  }

  // moment 本文の末尾に付く .moment-footer（無ければ何もしない。about-us 等はフッター無し）
  private setupFooter_() {
    const gearLink = this.content_.querySelector<HTMLAnchorElement>('.moment-footer-gear');
    if(gearLink) {
      gearLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        this.onClose_();
      });
    }

    const prevLink = this.content_.querySelector<HTMLAnchorElement>('a.moment-footer-prev');
    if(prevLink) {
      prevLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        this.world.openLayer(prevLink.getAttribute('href')!);
      });
    }

    const nextLink = this.content_.querySelector<HTMLAnchorElement>('a.moment-footer-next');
    if(nextLink) {
      nextLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        this.world.openLayer(nextLink.getAttribute('href')!);
      });
    }

    const links = this.content_.querySelector<HTMLElement>('.moment-footer-links');
    if(links) {
      for(const a of Array.from(links.querySelectorAll<HTMLAnchorElement>('a'))) {
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          this.world.openLayer(a.getAttribute('href')!);
        });
      }
    }
  }

  onClose_() {
    document.title = this.prevTitle_;
    if(this.world.canPopLayer()) {
      this.world.popLayer();
    } else {
      this.world.openLayer('/');
    }
  }

  onError_(err: any) {
    this.content_.innerHTML = `<h1>エラー！</h1>Error:<strong>${err}</strong>`;
  }

  onAttached() {
    this.world.canvas.addEventListener('mouseup', this.closeListener_, false);
  }

  onDetached() {
    this.world.canvas.removeEventListener('mouseup', this.closeListener_, false);
  }

  /** @override */
  destroy() {
  }
}

const htmlSrc = `
<div class="content">
</div>
`;

// viewBox 基準にして、ボタンの大きさは .back-button の width/height で決める。
const backButtonSrc = `
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
