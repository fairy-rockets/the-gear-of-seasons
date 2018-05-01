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
    /**
     * @type {Moment}
     * @private
     */
    this.selected_ = null;
    this.selectedAngle_ = null;
  }
  /**
   * @param {number} time 
   * @param {mat4} matWorld
   */
  render(time, matWorld) {
    const m = this.moments_.render(time, matWorld, this.mouseX_, this.mouseY_);
    if(m !== this.selected_) {
      this.selected_ = m;
      const tooltip = document.getElementById('tooltip');
      if(m == null) {
        tooltip.classList.add('hidden');
      }else{
        tooltip.classList.remove('hidden');
        const now = new Date();
        const date = m.date;
        let year = now.getFullYear() - date.getFullYear();
        now.setFullYear(date.getFullYear());
        let day = (now.getTime() - date.getTime()) / (1000 * 24 * 3600);
        if(day > 365/2) {
          year++;
          now.setFullYear(date.getFullYear()-1);
          day = (now.getTime() - date.getTime()) / (1000 * 24 * 3600);
        }else if(day < -365/2){
          year--;
          now.setFullYear(date.getFullYear()+1);
          day = (now.getTime() - date.getTime()) / (1000 * 24 * 3600);
        }
        day = Math.floor(day);
        if(year === 0 && day === 0){
          tooltip.innerHTML = `<div class="moment-title">${m.title}</div><div class="date">今日！</div>`;
        }else if(year == 0) {
          if(day > 0) {
            tooltip.innerHTML = `<div class="moment-title">${m.title}</div><div class="date">太陽が空を${day}周戻った頃</div>`;
          } else {
            tooltip.innerHTML = `<div class="moment-title">${m.title}</div><div class="date">太陽が空を${-day}周した頃</div>`;
          }
        }else{
          if(day == 0){
            tooltip.innerHTML = `<div class="moment-title">${m.title}</div><div class="date">季節の歯車が${year}回転する前</div>`;
          }else if(day > 0){
            tooltip.innerHTML = `<div class="moment-title">${m.title}</div><div class="date">季節の歯車が${year}回転戻って、<br>さらに太陽が空を${day}周戻った頃</div>`;
          }else{
            tooltip.innerHTML = `<div class="moment-title">${m.title}</div><div class="date">季節の歯車が${year}回転戻って、<br>その後太陽が空を${-day}周した頃</div>`;
          }
        }
        this.fixTooltipPosition_(tooltip);
      }
    }
  }

  /**
   * @param {HTMLDivElement} tooltip 
   */
  fixTooltipPosition_(tooltip) {
    const m = this.selected_;
    if((m.screenBottomY + m.screenTopY) / 2 / this.world_.canvas.height >= 0.5) {
      tooltip.style.top = (m.screenTopY - tooltip.clientHeight)+'px';
      tooltip.style.left = (m.screenTopX - tooltip.clientWidth/2)+'px';
    }else{
      tooltip.style.top = m.screenBottomY+'px';
      tooltip.style.left = (m.screenTopX - tooltip.clientWidth/2)+'px';
    }
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
   * 
   * @param {WheelEvent} event 
   */
  onWheelEvent_(event) {
    event.preventDefault();
    const world = this.world;
    world.gear.angle += event.deltaY * Math.PI / (360 * 10);
    world.gear.angle -= event.deltaX * Math.PI / (360 * 10);
    if(this.selected_) {
      this.fixTooltipPosition_(document.getElementById('tooltip'))
    }
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
<div id="tooltip" class="tooltip"></div>
`;
