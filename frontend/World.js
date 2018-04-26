import Gear from "./Gear";

export default class World {
  /**
   * 
   * @param {HTMLDivElement} wrapper
   * @param {HTMLCanvasElement} canvas 
   * @returns {World}
   */
  static fromCanvas(wrapper, canvas) {
    const gl = canvas.getContext('webgl');
    if(!gl) {
      return null;
    }
    return new World(wrapper, canvas, gl);
  }
  /**
   * @param {HTMLDivElement} wrapper
   * @param {HTMLCanvasElement} canvas 
   * @param {WebGLRenderingContext} gl 
   * @private
   */
  constructor(wrapper, canvas, gl) {
    this.wrapper_ = wrapper;
    this.canvas_ = canvas;
    this.gl_ = gl;
    this.runner_ = this.run.bind(this);
    this.gear_ = new Gear(this);
  }
  start() {
    this.init_();
    requestAnimationFrame(this.runner_);
  }
  init_() {

  }
  /**
   * @param {number} time 
   */
  run(time) {
    requestAnimationFrame(this.runner_);
    const gl = this.gl_;
    this.canvas_.width = this.wrapper_.clientWidth;
    this.canvas_.height = this.wrapper_.clientHeight;
    // canvasを初期化する色を設定する
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    // canvasを初期化する際の深度を設定する
    gl.clearDepth(1.0);
    // canvasを初期化
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.gear_.render(gl);

    gl.flush();
  }
}