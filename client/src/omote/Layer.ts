import World from './World';
import { mat4 } from 'gl-matrix';
import Gear from './actors/Gear';

export default abstract class Layer {
  protected readonly world_: World;
  private readonly path_: string;
  protected readonly element_: HTMLDivElement;
  protected title_: string;
  protected constructor(world: World, path: string) {
    this.world_ = world;
    this.path_ = path;
    this.element_ = document.createElement('div');
    this.element_.className = 'layer-wrapper';
    // document.title はスタック最上位のレイヤから導出する(World.applyHead_)。
    // 最初に配信された URL のレイヤだけは、サーバが <title> に入れた値を引き継ぐ。
    this.title_ = (path === world.initialPath) ? document.title : world.siteTitle;
  }

  get world(): World {
    return this.world_;
  }

  get gl(): WebGLRenderingContext {
    return this.world_.gl;
  }

  get gear(): Gear {
    return this.world_.gear;
  }

  get element(): HTMLDivElement {
    return this.element_;
  }

  get path(): string {
    return this.path_;
  }

  get title(): string {
    return this.title_;
  }
  abstract render(time: number, matWorld: mat4): void;
  abstract onAttached(): void;
  abstract onDetached(): void;
  abstract destroy(): void;
}