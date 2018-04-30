import World from '../World.js'
import Layer from '../Layer.js';
import Moments from '../actors/Moments.js';
import Moment from '../actors/Moment.js';
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
    this.moments_ = new Moments(world);
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
    this.moments_.render(worldMat);
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
    /** @type {Moment[]} */
    const models = [];
    for(let m of moments) {
      const model = new Moment(m.angle, new Date(m.date), m.title, m.image);
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
}

