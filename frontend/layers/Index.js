import World from '../World.js'
import Layer from '../Layer.js';
import Moments from '../actors/Moments.js';
import Moment from '../actors/Moment.js';
import { mat4, vec4 } from 'gl-matrix';
import * as debug from '../gl/debug.js';
import Page from './Page.js';

/**
  @typedef MomentData
  @type {object}
  @property {number} angle
  @property {string} date
  @property {string} title
  @property {string} permalink
  @property {string} image
  @property {string} url
*/
export default class Index extends Layer {
  /**
   * @param {World} world 
   */
  constructor(world) {
    super(world, '/');
    /** @private */
    this.wheelEventListener_ = this.onWheelEvent_.bind(this);
    /** @private */
    this.mouseMoveListener_ = this.onMouseMove_.bind(this);
    /** @private */
    this.mouseUpListener_ = this.onMouseUp_.bind(this);
    /** @private */
    this.moments_ = new Moments(world);
    /** @private */
    this.mouseX_ = 0;
    /** @private */
    this.mouseY_ = 0;

    this.element.innerHTML = htmlSrc;
    /**
     * @type {Moment}
     * @private
     */
    this.selected_ = null;
    /** @private */
    this.selectedAngle_ = null;

    /** @private */
    this.tooltip_ = document.createElement('div');
    this.tooltip_.classList.add('tooltip', 'hidden');
    this.element_.appendChild(this.tooltip_);

    /** @private */
    this.tooltipTitle_ = document.createElement('div');
    this.tooltipTitle_.classList.add('moment-title');
    this.tooltip_.appendChild(this.tooltipTitle_);

    /** @private */
    this.tooltipDate_ = document.createElement('div');
    this.tooltipDate_.classList.add('date');
    this.tooltip_.appendChild(this.tooltipDate_);

    /** @private */
    this.loaded_ = false;
  }
  /**
   * @param {number} time 
   * @param {mat4} matWorld
   */
  render(time, matWorld) {
    const m = this.moments_.render(time, matWorld, this.mouseX_, this.mouseY_);
    if(m !== this.selected_) {
      this.selected_ = m;
      this.onSelectionChanged_(m);
    }
  }

  /**
   * @param {Moment} m
   */
  onSelectionChanged_(m) {
    const tooltip = this.tooltip_;
    if(m == null) {
      tooltip.classList.add('hidden');
    } else {
      tooltip.classList.remove('hidden');

      // title
      this.tooltipTitle_.textContent = m.title;

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
        this.tooltipDate_.textContent = `今日！`;
      }else if(year == 0) {
        if(day > 0) {
          this.tooltipDate_.textContent = `太陽が空を${day}周する前`;
        } else {
          this.tooltipDate_.textContent = `太陽が空を${-day}周した後`;
        }
      }else{
        if(day == 0){
          this.tooltipDate_.textContent = `季節の歯車が${year}回転する前`;
        }else if(day > 0){
          this.tooltipDate_.innerHTML = `季節の歯車が${year}回転戻って、<br>さらに太陽が空を${day}周する前`;
        }else{
          this.tooltipDate_.innerHTML = `季節の歯車が${year}回転戻って、<br>その後太陽が空を${-day}周した後`;
        }
      }
      this.fixTooltipPosition_();
    }
  }
  /**
   * @private
   */
  fixTooltipPosition_() {
    const tooltip = this.tooltip_;
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
  onAttached() {
    super.onAttached();
    this.world.cursor = false;
    this.world.canvas.addEventListener('wheel', this.wheelEventListener_, false);
    this.world.canvas.addEventListener('mousemove', this.mouseMoveListener_, false);
    this.world.canvas.addEventListener('mouseup', this.mouseUpListener_, false);
    if(!this.loaded_) {
      this.fetch(300);
    }
  }
  /** @override */
  onDtached() {
    this.world.cursor = false;
    this.world.canvas.removeEventListener('wheel', this.wheelEventListener_, false);
    this.world.canvas.removeEventListener('mousemove', this.mouseMoveListener_, false);
    this.world.canvas.removeEventListener('mouseup', this.mouseUpListener_, false);
    super.onDtached();
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
   * @param {MouseEvent} ev 
   */
  onMouseUp_(ev) {
    ev.preventDefault();
    const m = this.selected_;
    if(!m) {
      return;
    }
    const content = fetch(m.url).then(resp => resp.text());
    this.world.pushLayer(new Page(this.world, m.permalink, content));
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
      this.fixTooltipPosition_();
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
      const model = new Moment(world, m.angle, new Date(m.date), m.title, m.permalink, m.image, m.url);
      model.relocation(models);
      models.push(model);
    }
    this.moments_.models = models;
    this.loaded_ = true;
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
`;
