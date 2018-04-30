import World from "./World";
import { mat4 } from "gl-matrix";

export default class Gear {
  /**
   * @param {World} world 
   * @param {WebGLRenderingContext} gl 
   */
  constructor(world, gl) {
    this.world_ = world;
    this.gl_ = gl;
    const vs = world.compileVertexShader(`
    attribute vec3 position;
    attribute vec4 color;
    uniform mat4 matrix;
    varying vec4 vColor;
    
    void main(void) {
        vColor = color;
        gl_Position = matrix * vec4(position, 1.0);
    }
    `);
    const fs = world.compileFragmentShader(`
    varying mediump vec4 vColor;

    void main(void) {
      gl_FragColor = vColor;
    }
    `);
    this.program_ = world.linkShaders(vs, fs);
    this.posMat_ = mat4.identity(mat4.create());
    this.angle_ = 0;
    this.mat_ = mat4.identity(mat4.create());
  }
  init() {
    const gl = this.gl_;
    const world = this.world_;
    this.generateModel(12, 10, 0.6, 1, 0.3);
  }
  /**
   * @param {number} width 
   * @param {number} height 
   */
  onSizeChanged(width, height) {
    const aspect = width/height;
    const posMat = this.posMat_;
    mat4.identity(posMat);
    mat4.rotateY(posMat, posMat, -20/180*Math.PI);
    mat4.scale(posMat, posMat, [10, 10, 10]);
    mat4.translate(posMat, posMat, [-1.3*aspect, 0, -1]);
  }
  /** @param {number} v */
  set angle(v) {
    this.angle_ = v;
  }
  /** @returns {number} */
  get angle() {
    return this.angle_;
  }
  /**
   * 
   * @param {mat4} mat 
   */
  render(worldMat) {
    const gl = this.gl_;
    const world = this.world_;
    const mat = this.mat_;

    mat4.identity(mat);
    mat4.rotateZ(mat, mat, this.angle_);
    mat4.mul(mat, this.posMat_, mat);
    mat4.mul(mat, worldMat, mat);
    
    try {
      this.program_.bind();
      this.vArray_.bindShader(this.program_, 'position');
      this.colorArray_.bindShader(this.program_, 'color');
      gl.uniformMatrix4fv(this.program_.uniformLoc('matrix'), false, mat);
      this.indexies_.bind();
      this.indexies_.render();
    } finally {
      this.vArray_.unbind();
      this.colorArray_.unbind();
      this.indexies_.unbind();
      this.program_.unbind();
    }
  }

  /**
   * 
   * @param {number} numCogs 
   * @param {number} numDivs
   * @param {number} innerRadius 
   * @param {number} outerRadius 
   * @param {number} depth
   */
  generateModel(numCogs, numDivs, innerRadius, outerRadius, depth) {
    const hsva = (h, s, v, a) => {
      if(s > 1 || v > 1 || a > 1){return;}
      const th = h % 360;
      const i = Math.floor(th / 60);
      const f = th / 60 - i;
      const m = v * (1 - s);
      const n = v * (1 - s * f);
      const k = v * (1 - s * (1 - f));
      if(!s > 0 && !s < 0){
        return [v, v, v, a];
      } else {
        const r = [v, n, m, m, k, v];
        const g = [k, v, v, n, m, m];
        const b = [m, m, k, v, v, n];
        return [r[i], g[i], b[i], a];
      }
    }
    const vertex = [];
    const index = [];
    const colors = [];
    const pi2 = Math.PI*2;
    /**
      @typedef Line
      @type {object}
      @property {number} innerTop
      @property {number} innerBottom
      @property {number} outerTop
      @property {number} outerBottom
    */
    /**
     * @type{Line}
     */
    let last = null;
    /**
     * @type{Line}
     */
    let first = null;
    const totalLines = numCogs * numDivs * 2;
    for(let i = 0; i < numCogs * 2; ++i) {
      for(let j = 0; j < numDivs; ++j) {
        const angle = pi2 * (i * numDivs + j) / totalLines;
        const radius = i % 2 == 0 ? outerRadius : outerRadius*0.8;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        let current = {
          innerTop:    vertex.length + 0,
          innerBottom: vertex.length + 1,
          outerTop:    vertex.length + 2,
          outerBottom: vertex.length + 3
        };
        vertex.push(
          [c * innerRadius, s * innerRadius, depth/2],
          [c * innerRadius, s * innerRadius, -depth/2],
          [c * radius,      s * radius,      depth/2],
          [c * radius,      s * radius,      -depth/2]
        );

        const h = angle * 360 / pi2;
        colors.push(
          hsva(h, 0.7, 1, 1),
          hsva(h, 0.7, 1, 1),
          hsva(h, 0.7, 1, 1),
          hsva(h, 0.7, 1, 1)
        );

        if(last) {
          // 内側の壁
          index.push([last.innerTop, current.innerTop, current.innerBottom]);
          index.push([current.innerBottom, last.innerBottom, last.innerTop]);
          // シルエット
          index.push([current.innerTop, last.innerTop, last.outerTop]);
          index.push([last.outerTop, current.outerTop, current.innerTop]);
          // 外側の壁
          index.push([current.outerTop, last.outerTop, last.outerBottom]);
          index.push([last.outerBottom, current.outerBottom, current.outerTop]);
        }
        last = current;
        if(!first) first = current;
      }
    }
    // 円環を閉じる
    {
      const current = first;
      // 内側の壁
      index.push([last.innerTop, current.innerTop, current.innerBottom]);
      index.push([current.innerBottom, last.innerBottom, last.innerTop]);
      // シルエット
      index.push([current.innerTop, last.innerTop, last.outerTop]);
      index.push([last.outerTop, current.outerTop, current.innerTop]);
      // 外側の壁
      index.push([current.outerTop, last.outerTop, last.outerBottom]);
      index.push([last.outerBottom, current.outerBottom, current.outerTop]);
    }
    //GL
    const flatten = (nested) => Array.prototype.concat.apply([], nested);
    const world = this.world_;
    const gl = this.gl_;

    this.vArray_ = world.createArrayBuffer(flatten(vertex), 3);
    this.colorArray_ = world.createArrayBuffer(flatten(colors), 4);
    this.indexies_ = world.createIndexBuffer(gl.TRIANGLES, flatten(index));
  }
  destroy() {
    this.vArray_.destroy();
    this.indexies_.destroy();
    this.program_.destoy();
  }
}