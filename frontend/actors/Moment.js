import World from "../World.js";
import { vec2 } from "gl-matrix";
import Texture from "../gl/Texture.js";

export default class Moment {
  static get DiscRadius() {
    return 0.2;
  }
  /**
   * @param {World} world
   * @param {string} angle 
   * @param {string} date 
   * @param {string} title 
   * @param {string} permalink
   * @param {string} imageUrl 
   * @param {string} url
   */
  constructor(world, angle, date, title, permalink, imageUrl, url) {
    this.world_ = world;
    this.gl_ = world.gl;
    // params
    this.angle_ = angle;
    this.date_ = date;
    this.title_ = title;
    this.permalink_ = permalink;
    this.imageUrl_ = imageUrl;
    this.url_ = url;
    this.tex_ = new Texture(world, imageUrl);
    this.c_ = Math.cos(this.angle_);
    this.s_ = -Math.sin(this.angle_);
    this.radius_ = -1;
    this.x_ = 0;
    this.y_ = 0;
    //
    this.screenTopX_ = 0;
    this.screenTopY_ = 0;
    this.screenBottomX_ = 0;
    this.screenBottomY_ = 0;
  }
  setScreenTop(screenTopX, screenTopY) {
    this.screenTopX_ = screenTopX;
    this.screenTopY_ = screenTopY;
  }
  setScreenBottom(screenBottomX, screenBottomY) {
    this.screenBottomX_ = screenBottomX;
    this.screenBottomY_ = screenBottomY;
  }
  /** @type {number} */
  get screenTopX() {
    return this.screenTopX_;
  }
  /** @type {number} */
  get screenTopY() {
    return this.screenTopY_;
  }
  /** @type {number} */
  get screenBottomX() {
    return this.screenBottomX_;
  }
  /** @type {number} */
  get screenBottomY() {
    return this.screenBottomY_;
  }
  /**
   * 
   * @param {Moment[]} moments 
   */
  relocation(moments) {
    const diameter = Moment.DiscRadius * 2;
    const diameter2 = diameter * diameter;
    const c = this.c_;
    const s = this.s_;
    let radius = 1.05 + Moment.DiscRadius;
    let fixed = true;
    while(fixed) {
      fixed = false
      const x = radius * c;
      const y = radius * s;

      const a = s;
      const b = -c;
      for(let other of moments) {
        const dx = x - other.x_;
        const dy = y - other.y_;
        if(Math.abs(dx) <= diameter && Math.abs(dy) <= diameter && (dx * dx + dy * dy) <= diameter2) {
          const d = (other.x_ * a) + (other.y_ * b);
          radius = other.radius_ + Math.sqrt(diameter2 - d*d);
          fixed = true;
          break;
        }
      }
    }
    this.radius_ = radius;
    this.x_ = c * radius;
    this.y_ = s * radius;
  }
  destroy() {
    this.tex_.destroy();
    this.tex_=null;
  }
  /** @returns {number} */
  get x() {
    return this.x_;
  }
  /** @returns {number} */
  get y() {
    return this.y_;
  }
  /** @returns {Texture} */
  get tex() {
    return this.tex_;
  }
  /** @returns {string} */
  get title() {
    return this.title_;
  }
  /** @returns {string} */
  get imageUrl() {
    return this.imageUrl_;
  }
  /** @returns {string} */
  get url() {
    return this.url_;
  }
  /** @returns {string} */
  get permalink() {
    return this.permalink_;
  }
  /** @returns {string} */
  get date() {
    return this.date_;
  }
}
