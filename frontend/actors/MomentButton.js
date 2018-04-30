import World from "../World.js";
import Moment from "../models/Moment.js"
import { mat4 } from "gl-matrix";

export default class MomentButton {
  /**
   * @param {World} world 
   */
  constructor(world) {
    this.world_ = world;
    this.gl_ = world.gl;

    const gl = this.gl_;

    const vs = world.compileVertexShader(`
    attribute vec3 position;
    attribute vec2 textureCoord;

    uniform mat4 matrix;

    varying vec2 vCoord;

    void main(void) {
        //vCenter = matrix * vec4(center, 1.0);
        vCoord = textureCoord;
        gl_Position = vec4(position, 1.0);//matrix * vec4(position, 1.0);
    }
    `);
    const fs = world.compileFragmentShader(`
    varying mediump vec2 vCoord;
    //uniform sampler2D texture;

    void main(void) {
      gl_FragColor = vec4(1,1,1,1);//texture2D(texture, vCoord);
    }
    `);
    this.program_ = world.linkShaders(vs, fs);
    this.modelMat_ = mat4.identity(mat4.create());
    this.mat_ = mat4.identity(mat4.create());
    this.vertexes_ = world.createArrayBuffer([
      -1.0,  1.0,  0.0,
       1.0,  1.0,  0.0,
      -1.0, -1.0,  0.0,
       1.0, -1.0,  0.0
    ],3);
    this.texCoords_ = world.createArrayBuffer([
      0.0, 0.0,
      1.0, 0.0,
      0.0, 1.0,
      1.0, 1.0
    ],2);
    this.indecies_ = world.createIndexBuffer(gl.TRIANGLES, [
      0, 1, 2,
      3, 2, 1
    ]);
    /** @type {Moment} */
    this.model_ = null;
    this.cnt_ = 0;
  }
  /**
   * @param {Moment} m
   */
  set model(m) {
    this.model_ = m;
    mat4.identity(this.modelMat_);
    mat4.translate(this.modelMat_, this.modelMat_, [m.x, m.y, 0]);
  }
  /**
   * 
   * @param {mat4} mat 
   */
  render(worldMat) {
    if(!this.model_) {
      return;
    }
    const gl = this.gl_;
    const world = this.world_;
    const gear = world.gear;
    const mat = this.mat_;

    mat4.identity(mat);
    //mat4.rotateZ(mat, mat, -gear.angle);
    //mat4.mul(mat, this.modelMat_, mat);
    //mat4.mul(mat, gear.modelMat, mat);
    mat4.rotateY(mat, mat, Math.PI / (this.cnt_ / 180));
    this.cnt++;
    mat4.mul(mat, worldMat, mat);
    //mat4.scale(mat, mat, [10, 10, 10]);
    //mat4.translate(mat, mat, [0, 0, 1]);
    
    try {
      this.program_.bind();
      this.vertexes_.bindShader(this.program_, 'position');
      this.texCoords_.bindShader(this.program_, 'textureCoord');
      gl.uniformMatrix4fv(this.program_.uniformLoc('matrix'), false, mat);
      this.indecies_.bind();
      this.indecies_.render();
    } finally {
      this.vertexes_.unbind();
      this.texCoords_.unbind();
      this.indecies_.unbind();
      this.program_.unbind();
    }
  }

  destroy() {
    this.vertexes_.destroy();
    this.texCoords_.destroy();
    this.indecies_.destroy();
    this.program_.destoy();
  }
}