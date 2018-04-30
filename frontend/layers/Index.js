import World from '../World.js'
import Layer from '../Layer.js';
import MomentButton from '../actors/MomentButton.js';
import Moment from '../models/Moment.js';
import { mat4 } from 'gl-matrix';

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
    /** @type {MomentButton[]} */
    this.buttons_ = new Array(100);
    for(let i = 0; i < this.buttons_.length; ++i) {
      this.buttons_[i] = new MomentButton(world);
    }
    /** @type {Moment[]} */
    this.moments_ = new Array(100);
  }
  /**
   * 
   * @param {WheelEvent} event 
   */
  onWheelEvent_(event) {
    event.preventDefault();
    const world = this.world;
    world.gear.angle += event.deltaY * Math.PI / (360 * 10);
  }
  /**
   * @param {number} time 
   * @param {mat4} worldMat
   */
  render(time, worldMat) {
    for(let btn of this.buttons_) {
      btn.render(worldMat);
    }
  }
  attach() {
    super.attach();
    this.world.canvas.addEventListener('wheel', this.wheelEventListener_);
    this.fetch(100);
  }
  detach() {
    this.world.canvas.removeEventListener('wheel', this.wheelEventListener_);
    super.detach();
  }

  /**
   * @param {MomentData[]} moments 
   */
  onLoadMoments_(moments) {
    this.moments_.splice(0,this.moments_.length);
    for(let m of moments) {
      const model = new Moment(m.angle, new Date(m.date), m.title, m.image);
      model.relocation(this.moments_);
      this.moments_.push(model);
    }
    let i = 0;
    for(let m of this.moments_) {
      this.buttons_[i].model = m;
      ++i;
    }
  }

  fetch(size) {
    fetch(`/moment/search?size=${size}`)
      .then(resp => resp.json())
      .then(this.onLoadMoments_.bind(this));
  }
}

