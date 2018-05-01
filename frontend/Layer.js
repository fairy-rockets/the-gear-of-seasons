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
  /**
   * @param {number} time 
   * @param {mat4} matWorld
   */
  render(time, matWorld) {
  }
  attach() {
    this.world.layer = this;
  }
  detach() {
    this.world.layer = null;
  }
  destroy() {

  }
}