import World from "../World.js";
import Moment from "./Moment.js"
import { mat4 } from "gl-matrix";

const Scale = 0.2;

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
    attribute vec2 textureCoord;
    uniform mat4 matrix;
    varying vec2 vTextureCoord;
    
    void main(void) {
      vTextureCoord = textureCoord;
      gl_Position = matrix * vec4(position, 1.0);
    }
    `);
    const fs = world.compileFragmentShader(`
    uniform sampler2D texture;
    varying mediump vec2 vTextureCoord;

    void main(void) {
      mediump vec2 center = vec2(0.5, 0.5);
      mediump float dist = distance(vTextureCoord, center);
      gl_FragColor =
        dist < 0.47 ? texture2D(texture, vTextureCoord) :
        dist < 0.5 ? texture2D(texture, vTextureCoord)*((0.5-dist)/0.2) + vec4(1,1,1,0.6) * (dist/0.2) :
        vec4(0, 0, 0, 0);
    }
    `);
    this.program_ = world.linkShaders(vs, fs);

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
    if(this.models_) {
      for(let m of this.models_) {
        m.destroy();
      }
    }
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
      this.texCoords_.bindShader(this.program_, 'textureCoord');
      this.indecies_.bind();
      for(let m of this.models_) {
        const tex = m.tex;
        if(!tex.ready) {
          continue;
        }
        tex.bindShader(this.program_, 'texture');
        mat4.identity(mat);
        mat4.rotateZ(mat, mat, -gear.angle);
        mat4.translate(mat, mat, [m.x, m.y, 0]);
        mat4.scale(mat,mat, [Scale, Scale, Scale]);
        mat4.rotateZ(mat, mat, +gear.angle);
        mat4.mul(mat, gear.modelMat, mat);
        mat4.mul(mat, worldMat, mat);
        gl.uniformMatrix4fv(this.program_.uniformLoc('matrix'), false, mat);
        this.indecies_.render();
      }
    } finally {
      this.vertexes_.unbind();
      this.texCoords_.unbind();
      this.indecies_.unbind();
      this.program_.unbind();
    }
  }

  destroy() {
    for(let m of this.models_) {
      m.destroy();
    }
    this.vertexes_.destroy();
    this.texCoords_.destroy();
    this.indecies_.destroy();
    this.program_.destoy();
  }
}