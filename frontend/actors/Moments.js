import World from "../World.js";
import Moment from "./Moment.js"
import { mat4 } from "gl-matrix";

export default class Moments {
  /**
   * @param {World} world 
   */
  constructor(world) {
    this.world_ = world;
    this.gl_ = world.gl;

    const gl = this.gl_;

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

    this.vertexes_ = world.createArrayBuffer([
      -1.0,  1.0,  0.0,
      1.0,  1.0,  0.0,
     -1.0, -1.0,  0.0,
      1.0, -1.0,  0.0
    ],3);
    this.colors_ = world.createArrayBuffer([
      1.0, 0.0, 0.0, 1.0,
      0.0, 1.0, 0.0, 1.0,
      0.0, 0.0, 1.0, 1.0,
      1.0, 1.0, 1.0, 1.0
    ],4);
    this.texCoords_ = world.createArrayBuffer([
      0.0, 0.0,
      1.0, 0.0,
      0.0, 1.0,
      1.0, 1.0
    ],2);
    this.indecies_ = world.createIndexBuffer(gl.TRIANGLES, [
      2, 1, 0,
      1, 2, 3
    ]);

    /** Matrix **/
    this.modelMat_ = mat4.identity(mat4.create());
    this.mat_ = mat4.identity(mat4.create());

    /** @type {Moment[]} */
    this.models_ = null;
  }
  /**
   * @param {Moment[]} m
   */
  set models(ms) {
    this.models_ = ms;
  }
  /**
   * 
   * @param {mat4} mat 
   */
  render(worldMat) {
    const gl = this.gl_;
    const world = this.world_;
    const gear = world.gear;
    const mat = this.mat_;

    if(!this.models_) {
      return;
    }


    try {
      this.program_.bind();
      this.vertexes_.bindShader(this.program_, 'position');
      this.colors_.bindShader(this.program_, 'color');
      //this.texCoords_.bindShader(this.program_, 'textureCoord');
      this.indecies_.bind();
      for(let m of this.models_) {
        mat4.identity(mat);
        mat4.rotateZ(mat, mat, gear.angle);
        mat4.translate(mat, mat, [m.x, m.y, 0]);
        mat4.scale(mat,mat, [0.1, 0.1, 0.1]);
        mat4.rotateZ(mat, mat, -gear.angle);
        mat4.mul(mat, gear.modelMat, mat);
        mat4.mul(mat, worldMat, mat);
        gl.uniformMatrix4fv(this.program_.uniformLoc('matrix'), false, mat);
        this.indecies_.render();
      }
    } finally {
      this.vertexes_.unbind();
      this.colors_.unbind();
      //this.texCoords_.unbind();
      this.indecies_.unbind();
      this.program_.unbind();
    }
  }

  destroy() {
    this.colors_.destroy();
    this.vertexes_.destroy();
    this.texCoords_.destroy();
    this.indecies_.destroy();
    this.program_.destoy();
  }
}