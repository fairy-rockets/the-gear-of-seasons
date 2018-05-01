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
export default class Index extends Layer {
  /**
   * @param {World} world 
   */
  constructor(world) {
    super(world);
    this.wheelEventListener_ = this.onWheelEvent_.bind(this);
    this.mouseMoveListener_ = this.onMouseMove_.bind(this);
    this.moments_ = new Moments(world);
    this.mouseX_ = 0;
    this.mouseY_ = 0;

    this.element.innerHTML = htmlSrc;
  }
  /**
   * 
   * @param {WheelEvent} event 
   */
  onWheelEvent_(event) {
    event.preventDefault();
    const world = this.world;
    world.gear.angle += event.deltaY * Math.PI / (360 * 10);
    world.gear.angle -= event.deltaX * Math.PI / (360 * 10);
  }
  /**
   * @param {number} time 
   * @param {mat4} matWorld
   */
  render(time, matWorld) {
    this.moments_.render(time, matWorld, this.mouseX_, this.mouseY_);
  }

  /** @override */
  attach() {
    super.attach();
    this.world.canvas.addEventListener('wheel', this.wheelEventListener_, false);
    this.world.canvas.addEventListener('mousemove', this.mouseMoveListener_, false);
    this.fetch(300);
  }

  /** @override */
  detach() {
    this.world.canvas.removeEventListener('wheel', this.wheelEventListener_, false);
    this.world.canvas.removeEventListener('mousemove', this.mouseMoveListener_, false);
    super.detach();
  }

  /**
   * @param {MouseEvent} ev 
   */
  onMouseMove_(ev) {
    ev.preventDefault();
    const canvas = this.world.canvas;
    const hw = canvas.width/2;
    const hh = canvas.height/2;

    this.mouseX_ = (ev.clientX - hw) / hw;
    this.mouseY_ = -(ev.clientY - hh) / hh;
  }

  /**
   * @param {MomentData[]} moments 
   */
  onLoadMoments_(moments) {
    const world = this.world;
    /** @type {Moment[]} */
    const models = [];
    for(let m of moments) {
      const model = new Moment(world, m.angle, new Date(m.date), m.title, m.image);
      model.relocation(models);
      models.push(model);
    }
    this.moments_.models = models;
  }

  fetch(size) {
    fetch(`/moment/search?size=${size}`)
      .then(resp => resp.json())
      .then(this.onLoadMoments_.bind(this));
  }

  /** @override */
  destroy() {
    this.moments_.destroy();
  }
}

const htmlSrc = `
<div class="header">
  <div class="title">
  <h1>妖精⊸ロケット</h1>
  季節の歯車
  </div>
  <div class="description">
  <a href="">About us</a>
  </div>
</div>
<div id="tooltip" class="tooltop"></div>
`;
