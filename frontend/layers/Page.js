import World from '../World.js'
import Layer from '../Layer.js';
import Moments from '../actors/Moments.js';
import Moment from '../actors/Moment.js';
import { mat4, vec4 } from 'gl-matrix';
import * as debug from '../gl/debug.js';

/**
  @typedef MomentData
  @type {object}
  @property {number} angle
  @property {string} date
  @property {string} title
  @property {string} image
*/
export default class Page extends Layer {
  /**
   * @param {World} world 
   * @param {string} permalink
   * @param {Promise<string>} contentPromise
   */
  constructor(world, permalink, contentPromise) {
    super(world, permalink);

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

    this.backButton_.addEventListener('mouseup', this.closeListener_, false);

    contentPromise.then(this.onLoad_.bind(this), this.onError_.bind(this));
  }
  /**
   * @param {number} time 
   * @param {mat4} matWorld
   */
  render(time, matWorld) {
  }

  /** @param {string} body */
  onLoad_(body) {
    this.content_.innerHTML = body;
    for(let src of this.content_.getElementsByTagName('script')) {
      const dst = document.createElement('script');
      dst.textContent = src.textContent;
      dst.src = src.src;
      dst.async = dst.async;
      const p = src.parentNode;
      p.insertBefore(dst, src);
      p.removeChild(src);
    }
  }

  onClose_() {
    if(this.world.canPopLayer()) {
      this.world.popLayer();
    } else {
      this.world.openLayer('/');
    }
  }

  /** @param {any} err */
  onError_(err) {
    this.content_.innerHTML = `<h1>エラー！</h1><strong>${err}</strong>`;
  }

  /** @override */
  onAttached() {
    super.onAttached();
    this.world.canvas.addEventListener('mouseup', this.closeListener_, false);
  }
  /** @override */
  onDtached() {
    super.onDtached();
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