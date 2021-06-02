import World from "../World";
import { vec2 } from "gl-matrix";
import Texture from "../gl/Texture";

export default class Moment {
  static get DiscRadius(): number {
    return 0.2;
  }
  private readonly world_: World;
  private readonly gl_: WebGLRenderingContext;
  private readonly angle_: number;
  private readonly date_: string;
  private readonly title_: string;
  private readonly path_: string;
  private readonly bodyURL_: string;
  private tex_: Texture | null;
  private readonly c_: number;
  private readonly s_: number;
  private radius_: number;
  private x_: number;
  private y_: number;
  private screenTopX_: number;
  private screenTopY_: number;
  private screenBottomX_: number;
  private screenBottomY_: number;
  constructor(world: World, angle: number, date: string, title: string, path: string, imageURL: string, bodyURL: string) {
    this.world_ = world;
    this.gl_ = world.gl;
    // params
    this.angle_ = angle;
    this.date_ = date;
    this.title_ = title;
    this.path_ = path;
    this.bodyURL_ = bodyURL;
    this.tex_ = new Texture(world, imageURL);
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
  setScreenTop(screenTopX: number, screenTopY: number) {
    this.screenTopX_ = screenTopX;
    this.screenTopY_ = screenTopY;
  }
  setScreenBottom(screenBottomX: number, screenBottomY: number) {
    this.screenBottomX_ = screenBottomX;
    this.screenBottomY_ = screenBottomY;
  }
  get screenTopX(): number {
    return this.screenTopX_;
  }
  get screenTopY(): number {
    return this.screenTopY_;
  }
  get screenBottomX(): number {
    return this.screenBottomX_;
  }
  get screenBottomY(): number {
    return this.screenBottomY_;
  }

  relocation(moments: Moment[]) {
    const diameter = Moment.DiscRadius * 2;
    const diameter2 = diameter * diameter;
    const c = this.c_;
    const s = this.s_;
    const a = s;
    const b = -c;
    moments.sort((a,b) => a.radius_ - b.radius_);

    /** @type {number[][]} */
    const range: number[][] = []
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
    this.tex_?.destroy();
    this.tex_ = null;
  }
  get x(): number {
    return this.x_;
  }
  get y(): number {
    return this.y_;
  }
  get tex(): Texture {
    return this.tex_!;
  }

  get title(): string {
    return this.title_;
  }
  get bodyURL(): string {
    return this.bodyURL_;
  }
  get path(): string {
    return this.path_;
  }
  get date(): string {
    return this.date_;
  }
}
