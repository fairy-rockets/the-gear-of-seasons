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
    this.shader_ = world.linkShaders(vs, fs);
  }
  init() {
    const gl = this.gl_;
    const world = this.world_;
    this.vArray_ = world.createArrayBuffer([
      0.0, 1.0, 0.0,
      1.0, -1.0, 0.0,
     -1.0, -1.0, 0.0
    ], 3);
    this.colorArray_ = world.createArrayBuffer([
      1.0, 0.0, 0.0, 1.0,
      0.0, 1.0, 0.0, 1.0,
      0.0, 0.0, 1.0, 1.0,
    ], 4);
    this.indexies_ = world.createIndexBuffer([0,1,2]);
  }
  generateModel(numCogs, radiusMax, divs) {
    const vertex = [];
    const index = [];
    for(let i = 0; i < numCogs * 2; ++i) {
      const radius = i % 2 == 0 ? radiusMax : radiusMax * 0.8;
      for(let j = 0; j < divs; ++j) {
      }
    }
  }
  /**
   * 
   * @param {mat4} mat 
   */
  render(mat) {
    const gl = this.gl_;
    try {
      gl.useProgram(this.shader_);
      this.vArray_.bindShader(this.shader_, 'position');
      this.colorArray_.bindShader(this.shader_, 'color');
      gl.uniformMatrix4fv(gl.getUniformLocation(this.shader_, 'matrix'), false, mat);
      this.indexies_.bind();
      this.indexies_.render();
    } finally {
      gl.useProgram(null);
      this.vArray_.unbind();
      this.colorArray_.unbind();
      this.indexies_.unbind();
    }
    
  }
}