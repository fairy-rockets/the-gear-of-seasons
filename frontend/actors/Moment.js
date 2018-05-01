import World from "../World.js";
import { vec2 } from "gl-matrix";
import Texture from "../gl/Texture.js";

const DiscRadius = 0.2;

export default class Moment {
  /**
   * @param {World} world
   * @param {string} angle 
   * @param {Date} date 
   * @param {string} title 
   * @param {string} imageUrl 
   */
  constructor(world, angle, date, title, imageUrl) {
    this.world_ = world;
    this.gl_ = world.gl;
    // params
    this.angle_ = angle;
    this.date_ = date;
    this.title_ = title;
    this.imageUrl = imageUrl;
    this.tex_ = new Texture(world, imageUrl);
    this.radius_ = -1;
    this.x_ = 0;
    this.y_ = 0;
  }
  /**
   * 
   * @param {Moment[]} moments 
   */
  relocation(moments) {
    const diameter = DiscRadius * 2;
    const diameter2 = diameter * diameter;
    const c = Math.cos(this.angle_);
    const s = -Math.sin(this.angle_);
    let radius = 1.05 + DiscRadius;
    let fixed = true;
    while(fixed) {
      fixed = false
      const x = radius * c;
      const y = radius * s;

      const a = s;
      const b = -c;
      for(let m of moments) {
        const dx = x - m.x_;
        const dy = y - m.y_;
        if(Math.abs(dx) > diameter || Math.abs(dy) > diameter) {
          continue;
        }
        if(Math.sqrt(dx * dx + dy * dy) < diameter) {
          const d = (m.x_ * a) + (m.y_ * b);
          radius = m.radius_ + Math.sqrt(diameter2 - d*d);
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
}
