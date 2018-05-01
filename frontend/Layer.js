import World from "./World";
import { mat4 } from "gl-matrix";
import Gear from "./actors/Gear";

export default class Layer {
  /**
   * @param {World} world 
   */
  constructor(world) {
    /** @private */
    this.world_ = world;
    /** @private */
    this.element_ = document.createElement('div');
    this.element_.className = 'layer-wrapper';
  }
  /**
   * @returns {World}
   */
  get world() {
    return this.world_;
  }
  /**
   * @returns {WebGLRenderingContext}
   */
  get gl() {
    return this.world_.gl;
  }
  /**
   * @returns {Gear}
   */
  get gear() {
    return this.world_.gear;
  }
  /** @returns {HTMLDivElement} */
  get element() {
    return this.element_;
  }
  /**
   * @param {number} time 
   * @param {mat4} matWorld
   */
  render(time, matWorld) {
  }
  onAttached() {
  }
  onDtached() {
  }
  destroy() {

  }
}