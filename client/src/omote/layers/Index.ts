import World from '../World'
import Layer from '../Layer';
import Moments from '../actors/Moments';
import Moment from '../actors/Moment';
import { mat4, vec4 } from 'gl-matrix';
import * as debug from '../gl/debug';
import Page from './Page';
import twemoji from 'twemoji';

interface MomentSummary{
  angle: number;
  date: string;
  title: string;
  path: string;
  imageURL: string;
  bodyURL: string;
}

export default class Index extends Layer {
  private readonly wheelEventListener_: (ev: WheelEvent) => void;
  private readonly mouseMoveListener_: (ev: MouseEvent) => void;
  private readonly mouseUpListener_: (ev: MouseEvent) => void;
  private readonly moments_: Moments;
  private mouseX_: number;
  private mouseY_: number;
  private selected_: Moment | null;
  private readonly tooltip_: HTMLDivElement;
  private readonly tooltipTitle_: HTMLDivElement;
  private readonly tooltipDate_: HTMLDivElement;
  private readonly aboutUsLink_: HTMLElement;
  private loaded_: boolean;
  constructor(world: World) {
    super(world, '/');
    this.wheelEventListener_ = this.onWheelEvent_.bind(this);
    this.mouseMoveListener_ = this.onMouseMove_.bind(this);
    this.mouseUpListener_ = this.onMouseUp_.bind(this);
    this.moments_ = new Moments(world);
    this.mouseX_ = NaN;
    this.mouseY_ = NaN;

    this.element.innerHTML = htmlSrc;
    this.selected_ = null;

    this.tooltip_ = document.createElement('div');
    this.tooltip_.classList.add('tooltip', 'hidden');
    this.element_.appendChild(this.tooltip_);

    this.tooltipTitle_ = document.createElement('div');
    this.tooltipTitle_.classList.add('moment-title');
    this.tooltip_.appendChild(this.tooltipTitle_);

    this.tooltipDate_ = document.createElement('div');
    this.tooltipDate_.classList.add('date');
    this.tooltip_.appendChild(this.tooltipDate_);

    this.aboutUsLink_ = this.element_.querySelector<HTMLElement>('#about-us-link')!;
    this.aboutUsLink_.addEventListener('click', (e) => {
      e.preventDefault();
      world.openLayer('/about-us/');
    });

    this.loaded_ = false;
  }

  render(time: number, matWorld: mat4) {
    const m = this.moments_.render(time, matWorld, this.mouseX_, this.mouseY_);
    if(m !== null && m !== this.selected_) {
      this.selected_ = m;
      this.onSelectionChanged_(m);
    }
  }

  private onSelectionChanged_(m: Moment) {
    const tooltip = this.tooltip_;
    if(m == null) {
      tooltip.classList.add('hidden');
    } else {
      tooltip.classList.remove('hidden');

      // title
      this.tooltipTitle_.textContent = m.title;
      twemoji.parse(this.tooltipTitle_);
      this.tooltipDate_.innerHTML = m.date;
      this.fixTooltipPosition_();
    }
  }
  /**
   * @private
   */
  fixTooltipPosition_() {
    const tooltip = this.tooltip_;
    const m = this.selected_;
    if(m == null) {
      return;
    }
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
    this.world.cursor = false;
    this.world.canvas.addEventListener('wheel', this.wheelEventListener_, false);
    this.world.canvas.addEventListener('mousemove', this.mouseMoveListener_, false);
    this.world.canvas.addEventListener('mouseup', this.mouseUpListener_, false);
    if(!this.loaded_) {
      this.fetch(300);
    }
    this.mouseX_ = NaN;
    this.mouseY_ = NaN;
  }
  /** @override */
  onDtached() {
    this.mouseX_ = NaN;
    this.mouseY_ = NaN;
    this.world.cursor = false;
    this.world.canvas.removeEventListener('wheel', this.wheelEventListener_, false);
    this.world.canvas.removeEventListener('mousemove', this.mouseMoveListener_, false);
    this.world.canvas.removeEventListener('mouseup', this.mouseUpListener_, false);
  }

  onMouseMove_(ev: MouseEvent) {
    ev.preventDefault();
    const canvas = this.world.canvas;
    const hw = canvas.width/2;
    const hh = canvas.height/2;

    this.mouseX_ = (ev.clientX - hw) / hw;
    this.mouseY_ = -(ev.clientY - hh) / hh;
  }

  onMouseUp_(ev: MouseEvent) {
    ev.preventDefault();
    const m = this.selected_;
    if(!m) {
      return;
    }
    const content = fetch(m.bodyURL).then(resp => resp.text());
    this.world.pushLayer(new Page(this.world, m.path, content));
  }

  /**
   * 
   * @param {WheelEvent} event 
   */
  onWheelEvent_(event: WheelEvent) {
    event.preventDefault();
    const world = this.world;
    let dx = event.deltaX;
    let dy = event.deltaY;
    switch(event.deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      dx *= 30;
      dy *= 30;
    break;
    case WheelEvent.DOM_DELTA_PIXEL:
      break;
    case WheelEvent.DOM_DELTA_PAGE:
      dx *= 300;
      dy *= 300;
      break;
    default:
      throw new Error("Unknown delta mode: "+event.deltaMode);
    }
    
    world.gear.angle += dy * Math.PI / (360 * 10);
    world.gear.angle -= dx * Math.PI / (360 * 10);
    if(this.selected_) {
      this.fixTooltipPosition_();
    }
  }

  onLoadMoments_(moments: MomentSummary[]) {
    const world = this.world;
    const models: Moment[] = [];
    for(let m of moments) {
      const model = new Moment(world, m.angle, m.date, m.title, m.path, m.imageURL, m.bodyURL);
      model.relocation(models);
      models.push(model);
    }
    this.moments_.models = models;
    this.loaded_ = true;
  }

  fetch(size: number) {
    fetch(`/moment/search?size=${size}`)
      .then(resp => resp.json())
      .then(this.onLoadMoments_.bind(this));
  }

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
  <a href="/about-us/" id="about-us-link">About us</a>
  </div>
</div>
`;
