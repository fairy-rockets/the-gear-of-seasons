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
    const a = s;
    const b = -c;
    moments.sort((a,b) => a.radius_ - b.radius_);

    /** @type {number[][]} */
    const range = []
    for(let m of moments) {
      const crossRadius = m.x_ * c + m.y_ * s;
      if(crossRadius <= 0) continue;
      const normLength = Math.abs(m.x_ * a + m.y_ * b);
      if(normLength > diameter) continue;
      const delta = Math.sqrt(Math.max(0, diameter2 - Math.pow(normLength, 2)));
      range.push([crossRadius - delta, crossRadius + delta]);
    }
    let radius = 1.05 + Moment.DiscRadius;
    range.sort((a,b) => a[0]-b[0]);
    for(let r of range) {
      if(r[0] <= radius && radius <= r[1]) {
        radius = Math.max(r[1], radius);
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
