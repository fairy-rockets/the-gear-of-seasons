import World from '../World.js'
import Layer from '../Layer.js';
import Moments from '../actors/Moments.js';
import Moment from '../actors/Moment.js';
import { mat4, vec4 } from 'gl-matrix';

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
    this.world.canvas.addEventListener('wheel', this.wheelEventListener_, false);
    this.world.canvas.addEventListener('mousemove', this.mouseMoveListener_, false);
    this.fetch(300);
  }

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
    const world = this.world;
    const width = world.canvas.width;
    const height = this.world.canvas.height;
    const y = -(ev.clientY - height/2) / height;
    const x = (ev.clientX - width/2) / height;

    // calculate mouse position in Z=0
    const mat = mat4.identity(mat4.create());
    mat4.copy(mat, world.gear.modelMat);
    mat4.mul(mat, world.mat_, mat);
    const matP = mat4.set(mat4.create(),
      mat[0], mat[1], mat[2], mat[3],
      mat[4], mat[5], mat[6], mat[7],
      0,      0,      -1,     0,
      -x,     -y,     0,      -1
    );
    const vecP = vec4.fromValues(-mat[12], -mat[13], -mat[14], -mat[15]);
    const invP = mat4.invert(mat4.create(), matP);
    const out = vec4.transformMat4(vec4.create(), vecP, invP); /* = (X,Y,z,w) */
    
    const px = out[0];
    const py = out[1];
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
}

