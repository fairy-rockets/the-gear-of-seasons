import World from "./World";
import { mat4 } from "gl-matrix";

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
   * @param {number} time 
   * @param {mat4} worldMat
   */
  render(time, worldMat) {
  }
  attach() {
    this.world.layer = this;
  }
  detach() {
    this.world.layer = null;
  }
}