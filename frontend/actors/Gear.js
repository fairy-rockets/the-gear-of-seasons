import World from "../World.js";
import { mat4 } from "gl-matrix";

const hsv = (h, s, v) => {
  if(s > 1 || v > 1){return;}
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
    return [r[i], g[i], b[i], 1];
  }
};

const Colors = [
  /*  1月 */ [180, 0.00, 0.90],
  /*  2月 */ [190, 0.36, 1.00],
  /*  3月 */ [344, 0.55, 1.00],
  /*  4月 */ [328, 0.25, 1.00],
  /*  5月 */ [126, 0.58, 0.99],
  /*  6月 */ [258, 0.58, 0.99],
  /*  7月 */ [222, 0.58, 0.99],
  /*  8月 */ [188, 0.58, 0.99],
  /*  9月 */ [146, 0.58, 0.99],
  /* 10月 */ [ 76, 0.58, 0.99],
  /* 11月 */ [ 20, 0.74, 0.95],
  /* 12月 */ [  0,    0, 0.59],
];

/**
 * @param {number} angle 
 * @returns {number[]}
 */
const colorOfAngle = (angle) => {
  angle = ((angle % 360) + 360) % 360;
  const n = Math.floor(angle % 30);
  const alpha = (angle - (n * 30)) / 30.0;
  const beta = 1-alpha;
  const before = Colors[(n+12-1)%12];
  const after = Colors[(n+1)%12];
  return hsv(
    before[0] * alpha + after[0] * beta,
    before[1] * alpha + after[1] * beta,
    before[2] * alpha + after[2] * beta,
  );
};

export default class Gear {
  /**
   * @param {World} world 
   */
  constructor(world) {
    this.world_ = world;
    this.gl_ = world.gl;
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
    this.modelMat_ = mat4.identity(mat4.create());
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
    const modelMat = this.modelMat_;
    mat4.identity(modelMat);
    //mat4.rotateY(modelMat, modelMat, -20/180*Math.PI);
    mat4.scale(modelMat, modelMat, [10, 10, 10]);
    mat4.translate(modelMat, modelMat, [-0.8*aspect, +0.8, -1.5]);
  }
  /** @param {number} v */
  set angle(v) {
    this.angle_ = v;
  }
  /** @returns {number} */
  get angle() {
    return this.angle_;
  }
  /** @returns {mat4} */
  get modelMat() {
    return this.modelMat_;
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
    mat4.rotateZ(mat, mat, -this.angle_);
    mat4.mul(mat, this.modelMat_, mat);
    mat4.mul(mat, worldMat, mat);
    
    try {
      this.program_.bind();
      this.vertexes_.bindShader(this.program_, 'position');
      this.colorArray_.bindShader(this.program_, 'color');
      gl.uniformMatrix4fv(this.program_.uniformLoc('matrix'), false, mat);
      this.indecies_.bind();
      this.indecies_.render();
    } finally {
      this.vertexes_.unbind();
      this.colorArray_.unbind();
      this.indecies_.unbind();
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
    const vertexes = [];
    const indecies = [];
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
          innerTop:    vertexes.length + 0,
          innerBottom: vertexes.length + 1,
          outerTop:    vertexes.length + 2,
          outerBottom: vertexes.length + 3
        };
        vertexes.push(
          [c * innerRadius, s * innerRadius, depth/2],
          [c * innerRadius, s * innerRadius, -depth/2],
          [c * radius,      s * radius,      depth/2],
          [c * radius,      s * radius,      -depth/2]
        );

        const color = hsv(angle * 360 / pi2, 0.7, 1);
        colors.push(color, color, color, color);

        if(last) {
          // 内側の壁
          indecies.push([last.innerTop, current.innerTop, current.innerBottom]);
          indecies.push([current.innerBottom, last.innerBottom, last.innerTop]);
          // シルエット
          indecies.push([current.innerTop, last.innerTop, last.outerTop]);
          indecies.push([last.outerTop, current.outerTop, current.innerTop]);
          // 外側の壁
          indecies.push([current.outerTop, last.outerTop, last.outerBottom]);
          indecies.push([last.outerBottom, current.outerBottom, current.outerTop]);
        }
        last = current;
        if(!first) first = current;
      }
    }
    // 円環を閉じる
    {
      const current = first;
      // 内側の壁
      indecies.push([last.innerTop, current.innerTop, current.innerBottom]);
      indecies.push([current.innerBottom, last.innerBottom, last.innerTop]);
      // シルエット
      indecies.push([current.innerTop, last.innerTop, last.outerTop]);
      indecies.push([last.outerTop, current.outerTop, current.innerTop]);
      // 外側の壁
      indecies.push([current.outerTop, last.outerTop, last.outerBottom]);
      indecies.push([last.outerBottom, current.outerBottom, current.outerTop]);
    }
    //GL
    const flatten = (nested) => Array.prototype.concat.apply([], nested);
    const world = this.world_;
    const gl = this.gl_;

    this.vertexes_ = world.createArrayBuffer(flatten(vertexes), 3);
    this.colorArray_ = world.createArrayBuffer(flatten(colors), 4);
    this.indecies_ = world.createIndexBuffer(gl.TRIANGLES, flatten(indecies));
  }
  destroy() {
    this.vertexes_.destroy();
    this.indecies_.destroy();
    this.program_.destoy();
  }
}