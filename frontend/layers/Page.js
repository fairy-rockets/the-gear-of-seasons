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
   * @param {Promise<string>} contentPromise
   */
  constructor(world, contentPromise) {
    super(world);

    this.contentWrapper_ = document.createElement('div');
    this.contentWrapper_.classList.add('content-wrapper');
    this.element.appendChild(this.contentWrapper_);

    this.content_ = document.createElement('div');
    this.content_.classList.add('content');
    this.contentWrapper_.appendChild(this.content_);

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
  }

  /** @param {any} err */
  onError_(err) {
    this.content_.innerHTML = `<h1>エラー！</h1><strong>body</strong>`;
  }

  /** @override */
  onAttached() {
    super.onAttached();
  }
  /** @override */
  onDtached() {
    super.onDtached();
  }

  /** @override */
  destroy() {
  }
}

const htmlSrc = `
<div class="content">
</div>
`;
