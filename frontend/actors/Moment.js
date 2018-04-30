import { vec2 } from "gl-matrix";

const Size = 0.1;

export default class Moment {
  /**
   * @param {string} angle 
   * @param {Date} date 
   * @param {string} title 
   * @param {string} imageUrl 
   */
  constructor(angle, date, title, imageUrl) {
    this.angle_ = angle;
    this.date_ = date;
    this.title_ = title;
    this.imageUrl = imageUrl;
    this.image = new Image();
    this.image.src = this.imageUrl;
    this.radius_ = -1;
    this.x_ = 0;
    this.y_ = 0;
  }
  /**
   * 
   * @param {Moment[]} moments 
   */
  relocation(moments) {
    const c = Math.cos(this.angle_);
    const s = Math.sin(this.angle_);
    let radius = 1.2;
    for(let m of moments) {
      const dx = radius * c - m.x_;
      const dy = radius * s - m.y_;
      const d = Math.sqrt(dx * dx + dy * dy);
      if(d <= Size * 2) {
        radius = m.radius_ + Size * 2;
      }
    }
    this.radius_ = radius;
    this.x_ = c * radius;
    this.y_ = s * radius;
  }
  /** @returns {number} */
  get x() {
    return this.x_;
  }
  /** @returns {number} */
  get y() {
    return this.y_;
  }
}
