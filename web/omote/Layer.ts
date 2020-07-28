import World from "./World";
import { mat4 } from "gl-matrix";
import Gear from "./actors/Gear";

export default abstract class Layer {
  protected readonly world_: World;
  private readonly path_: string;
  protected readonly element_: HTMLDivElement;
  constructor(world: World, path: string) {
    this.world_ = world;
    this.path_ = path;
    this.element_ = document.createElement('div');
    this.element_.className = 'layer-wrapper';
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
  abstract render(time: number, matWorld: mat4): void;
  abstract onAttached(): void;
  abstract onDtached(): void;
  abstract destroy(): void;
}