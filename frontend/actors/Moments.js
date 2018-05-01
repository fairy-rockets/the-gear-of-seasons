import World from "../World.js";
import Moment from "./Moment.js"
import { mat4, vec4 } from "gl-matrix";

const Scale = Moment.DiscRadius;

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
    precision mediump float;

    uniform bool hovered;
    uniform sampler2D texture;
    varying vec2 vTextureCoord;

    void main(void) {
      vec2 center = vec2(0.5, 0.5);
      float dist = distance(vTextureCoord, center);
      vec4 texColor = texture2D(texture, vTextureCoord);
      vec4 ringColor = hovered ? vec4(1, 1, 1, 0.6) : vec4(0,0,0,0.6);
      gl_FragColor =
        dist < 0.47 ? texColor :
        dist < 0.5 ? texColor*((0.5-dist)/0.3) + ringColor * (dist/0.3) :
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
   * @param {number} time 
   * @param {mat4} mat 
   * @param {number} mouseX
   * @param {number} mouseY
   */
  render(time, worldMat, mouseX, mouseY) {
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
        mat4.rotateZ(mat, mat, +gear.angle);
        mat4.translate(mat, mat, [m.x, m.y, 0]);
        mat4.scale(mat,mat, [Scale, Scale, Scale]);
        mat4.rotateZ(mat, mat, -gear.angle);
        mat4.mul(mat, gear.modelMat, mat);
        mat4.mul(mat, worldMat, mat);
        const [dx, dy] = this.calcMousePos_(mat, mouseX, mouseY)
        const hovered = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx * dx + dy * dy) <= 1;
        gl.uniformMatrix4fv(this.program_.uniformLoc('matrix'), false, mat);
        gl.uniform1i(this.program_.uniformLoc('hovered'), hovered);
        this.indecies_.render();
      }
    } finally {
      this.vertexes_.unbind();
      this.texCoords_.unbind();
      this.indecies_.unbind();
      this.program_.unbind();
    }
  }
  /**
   * 
   * @param {mat4} mat 
   * @param {number} x 
   * @param {number} y 
   * @returns {number[]}
   */
  calcMousePos_(mat, x, y) {
    const matP = mat4.set(mat4.create(),
      mat[0], mat[1], mat[2], mat[3],
      mat[4], mat[5], mat[6], mat[7],
      0,      0,      -1,     0,
      -x,     -y,     0,      -1
    );
    const vecP = vec4.fromValues(-mat[12], -mat[13], -mat[14], -mat[15]);
    const invP = mat4.invert(mat4.create(), matP);
    const out = vec4.transformMat4(vec4.create(), vecP, invP); /* = (X,Y,z,w) */
    return [out[0], out[1]];
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