import World from "../World.js";
import Moment from "./Moment.js"
import { mat4, vec4 } from "gl-matrix";

export default class Background {
  /**
   * @param {World} world 
   */
  constructor(world) {
    this.world_ = world;
    this.gl_ = world.gl;

    const gl = this.gl_;

    const vs = world.compileVertexShader(vsSrc);
    const fs = world.compileFragmentShader(fsSrc);
    this.program_ = world.linkShaders(vs, fs);

    this.vertexes_ = world.createArrayBuffer([
      -30.0, +30.0,  0.00,
      +30.0, +30.0,  0.00,
      -30.0, -30.0,  0.00,
      +30.0, -30.0,  0.00
    ],3);
    this.indecies_ = world.createIndexBuffer(gl.TRIANGLES, [
      2, 1, 0,
      1, 2, 3
    ]);

    /** Matrix **/
    this.matModel_ = mat4.identity(mat4.create());

    this.matLoc_ = mat4.identity(mat4.create());
    mat4.translate(this.matLoc_, this.matLoc_, [0, 0, -1]);

    this.mat_ = mat4.identity(mat4.create());
  }
  /**
   * @param {number} time 
   * @param {mat4} mat 
   */
  render(time, matWorld) {
    const gl = this.gl_;
    const world = this.world_;
    const mat = this.mat_;

    try {
      this.program_.bind();
      this.vertexes_.bindShader(this.program_, 'position');
      this.indecies_.bind();
      mat4.copy(mat, this.matModel_);
      mat4.mul(mat, this.matLoc_, mat);
      mat4.mul(mat, matWorld, mat);
      gl.uniformMatrix4fv(this.program_.uniformLoc('matrix'), false, mat);
      gl.uniform1f(this.program_.uniformLoc('time'), time);
      this.indecies_.render();
    } finally {
      this.vertexes_.unbind();
      this.indecies_.unbind();
      this.program_.unbind();
    }
  }
  destroy() {
    for(let m of this.models_) {
      m.destroy();
    }
    this.vertexes_.destroy();
    this.indecies_.destroy();
    this.program_.destoy();
  }
}

const vsSrc = `
attribute vec3 position;
uniform mat4 matrix;
varying vec2 vPosition;

void main(void) {
  vPosition = position.xy;
  gl_Position = matrix * vec4(position, 1.0);
}
`;
const fsSrc = `
precision mediump float;

uniform float time;
varying vec2 vPosition;

// https://stackoverflow.com/questions/4200224/random-noise-functions-for-glsl
float rand(vec2 co){
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main(void) {
  float n = 0.2;
  gl_FragColor = vec4(n, n, n, 1);
}
`;