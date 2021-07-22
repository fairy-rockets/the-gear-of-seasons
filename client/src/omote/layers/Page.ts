import World from '../World'
import Layer from '../Layer';
import { mat4 } from 'gl-matrix';
import twemoji from 'twemoji';

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

    this.backButton_.addEventListener('mouseup', this.closeListener_, false);

    contentPromise.then(this.onLoad_.bind(this), this.onError_.bind(this));
  }

  render(time: number, matWorld: mat4) {
  }

  onLoad_(body: string) {
    this.content_.innerHTML = body;
    twemoji.parse(this.content_);

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

const backButtonSrc = `
<svg width="5em" height="5em">
  <rect
      x="0" y="0"
      width="5em" height="5em"
      rx="1em" ry="1em"
      style="fill:white;fill-opacity:0.7;" />
  <line stroke-linecap="round"
          x1="1em" y1="1em" x2="4em" y2="4em"
          stroke="rgba(0, 0, 0, 0.5)" stroke-width="1em"/>
  <line stroke-linecap="round"
          x1="1em" y1="4em" x2="4em" y2="1em"
          stroke="rgba(0, 0, 0, 0.5)" stroke-width="1em"/>
</svg>
`;