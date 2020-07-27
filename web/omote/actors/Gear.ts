import World from "../World";
import Program from "../gl/Program";
import ArrayBuffer from "../gl/ArrayBuffer";
import IndexBuffer from "../gl/IndexBuffer";
import { mat4, vec4, ReadonlyMat4 } from "gl-matrix";

import { Winter, Spring, Summer, Autumn } from './Seasons.js';

function calcTodaysAngle(): number {
  const now = new Date();
  const beg = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), 11, 31, 12, 59, 59, 999);
  return Math.PI * 2 * ((now.getTime() - beg.getTime()) / (end.getTime() - beg.getTime()));
}

export default class Gear {
  private readonly world_: World;
  private readonly gl_: WebGLRenderingContext;
  private readonly program_: Program;
  private readonly matModel_: mat4;
  private readonly matLoc_: mat4;
  private readonly matLocModel_: mat4;
  private readonly matTmp_: mat4;
  private readonly todaysAngle_: number;
  private angle_: number;

  private readonly winterLightPos_: vec4;
  private readonly springLightPos_: vec4;
  private readonly summerLightPos_: vec4;
  private readonly autumnLightPos_: vec4;

  private vertexes_: ArrayBuffer;
  private norms_: ArrayBuffer;
  private indecies_: IndexBuffer;
constructor(world: World) {
    this.world_ = world;
    this.gl_ = world.gl;
    const vs = world.compileVertexShader(vsSrc);
    const fs = world.compileFragmentShader(fsSrc);
    this.program_ = world.linkShaders(vs, fs);

    this.matModel_ = mat4.identity(mat4.create());
    this.matLoc_ = mat4.identity(mat4.create());

    this.matLocModel_ = mat4.identity(mat4.create());
    this.matTmp_ = mat4.identity(mat4.create());

    this.todaysAngle_ = calcTodaysAngle();
    this.angle_ = this.todaysAngle_ - Math.PI/6;

    this.winterLightPos_ = vec4.create();
    this.springLightPos_ = vec4.create();
    this.summerLightPos_ = vec4.create();
    this.autumnLightPos_ = vec4.create();
    this.generateModel_(12, 10, 0.6, 1, 0.3);
  }

  onSizeChanged(width: number, height: number) {
    const aspect = width / height;
    const matModel = this.matModel_;
    const matLoc = this.matLoc_;
    mat4.identity(matModel);
    mat4.identity(matLoc);
    //mat4.rotateY(matModel, matModel, -90/180*Math.PI);
    mat4.scale(matModel, matModel, [10, 10, 10]);
    mat4.translate(matLoc, matLoc, [-0.8 * aspect, 0.8, -1.5]);
  }
  set angle(v: number) {
    this.angle_ = v;
  }
  get angle(): number {
    return this.angle_;
  }
  get matrix(): mat4 {
    return this.matLocModel_;
  }
  get winterLightPos(): vec4 {
    return this.winterLightPos_;
  }
  get springLightPos(): vec4 {
    return this.springLightPos_;
  }
  get summerLightPos(): vec4 {
    return this.summerLightPos_;
  }
  get autumnLightPos(): vec4 {
    return this.autumnLightPos_;
  }
  /**
   * @param {mat4} matWorld 
   */
  beforeRender(matWorld: ReadonlyMat4) {
    const matModel = this.matModel_;
    const matLoc = this.matLoc_;

    const matLocModel = this.matLocModel_;
    const matTmp = this.matTmp_;

    // calc model matrix
    mat4.identity(matLocModel);
    mat4.mul(matLocModel, matLoc, matLocModel);
    mat4.mul(matLocModel, matModel, matLocModel);
    mat4.rotateZ(matLocModel, matLocModel, this.angle_);

    // calc final matrix (eye + projection)
    mat4.mul(matTmp, matWorld, matLocModel);

    vec4.transformMat4(this.winterLightPos_, Winter.position, matLocModel);
    vec4.transformMat4(this.springLightPos_, Spring.position, matLocModel);
    vec4.transformMat4(this.summerLightPos_, Summer.position, matLocModel);
    vec4.transformMat4(this.autumnLightPos_, Autumn.position, matLocModel);
  }
  /**
   * @param {mat4} matWorld 
   */
  render(matWorld: mat4) {
    const gl = this.gl_;
    const world = this.world_;

    const matLocModel = this.matLocModel_;
    const matTmp = this.matTmp_;

    try {
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      this.program_.bind();
      this.vertexes_.bindShader(this.program_, 'position');
      this.norms_.bindShader(this.program_, 'norm');

      gl.uniformMatrix4fv(this.program_.uniformLoc('matLocModel'), false, matLocModel);
      gl.uniformMatrix4fv(this.program_.uniformLoc('matrix'), false, matTmp);

      gl.uniform4fv(this.program_.uniformLoc('winterColor'), Winter.color);
      gl.uniform4fv(this.program_.uniformLoc('springColor'), Spring.color);
      gl.uniform4fv(this.program_.uniformLoc('summerColor'), Summer.color);
      gl.uniform4fv(this.program_.uniformLoc('autumnColor'), Autumn.color);

      gl.uniform4fv(this.program_.uniformLoc('winterPosition'), this.winterLightPos_);
      gl.uniform4fv(this.program_.uniformLoc('springPosition'), this.springLightPos_);
      gl.uniform4fv(this.program_.uniformLoc('summerPosition'), this.summerLightPos_);
      gl.uniform4fv(this.program_.uniformLoc('autumnPosition'), this.autumnLightPos_);

      this.indecies_.bind();
      this.indecies_.render();
    } finally {
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      this.vertexes_.unbind();
      this.norms_.unbind();
      this.indecies_.unbind();
      this.program_.unbind();
    }
  }

  generateModel_(numCogs: number, numDivs: number, innerRadius: number, outerRadius: number, depth: number) {
    const pi2 = Math.PI * 2;

    /** @type {number[]} */
    const vertexes: number[] = [];
    /** @type {number[]} */
    const indecies: number[] = [];
    /** @type {number[]} */
    const norms: number[] = [];

    const totalLines = numCogs * numDivs * 2;

    const middleRadius = outerRadius * 0.8;

    const angleBase = pi2/48;

    for (let i = 0; i < numCogs * 2; ++i) {
      const radius = i % 2 == 0 ? outerRadius : middleRadius;
      for (let j = 0; j <= numDivs; ++j) {
        const angle = angleBase + pi2 * (i * numDivs + j) / totalLines;

        const c = Math.cos(angle);
        const s = Math.sin(angle);
        if (j === 0) {
          // 壁を作る
          const off = vertexes.length / 3;
          vertexes.push(
            c * middleRadius, s * middleRadius, +depth / 2,
            c * middleRadius, s * middleRadius, -depth / 2,
            c * outerRadius,  s * outerRadius,  +depth / 2,
            c * outerRadius,  s * outerRadius,  -depth / 2
          );
          if(i % 2 === 0) {
            norms.push(
              s, -c, 0,
              s, -c, 0,
              s, -c, 0,
              s, -c, 0,
            );
            indecies.push(off + 1, off + 3, off + 2);
            indecies.push(off + 2, off + 0, off + 1);
          }else{
            norms.push(
              -s, c, 0,
              -s, c, 0,
              -s, c, 0,
              -s, c, 0
            );
            indecies.push(off + 2, off + 3, off + 1);
            indecies.push(off + 1, off + 0, off + 2);
          }
        } else {
          const prevAngle = angleBase + pi2 * (i * numDivs + j - 1) / totalLines;
          const pc = Math.cos(prevAngle);
          const ps = Math.sin(prevAngle);

          { // 内側の壁
            const off = vertexes.length / 3;
            vertexes.push(
              pc * innerRadius, ps * innerRadius, +depth / 2,
              pc * innerRadius, ps * innerRadius, -depth / 2,
              c * innerRadius, s * innerRadius, +depth / 2,
              c * innerRadius, s * innerRadius, -depth / 2,
            );
            norms.push(
              -c, -s, 0,
              -c, -s, 0,
              -c, -s, 0,
              -c, -s, 0,
            );
            indecies.push(off + 2, off + 3, off + 1);
            indecies.push(off + 1, off + 0, off + 2);
          }

          { // シルエット
            const off = vertexes.length / 3;
            vertexes.push(
              pc * innerRadius, ps * innerRadius, +depth / 2,
              pc * radius, ps * radius, +depth / 2,
              c * innerRadius, s * innerRadius, +depth / 2,
              c * radius, s * radius, +depth / 2,
            );
            norms.push(
              0, 0, 1,
              0, 0, 1,
              0, 0, 1,
              0, 0, 1,
            );
            indecies.push(off + 2, off + 0, off + 1);
            indecies.push(off + 1, off + 3, off + 2);
          }

          { // 外側の壁
            const off = vertexes.length / 3;
            vertexes.push(
              pc * radius, ps * radius, +depth / 2,
              pc * radius, ps * radius, -depth / 2,
              c * radius, s * radius, +depth / 2,
              c * radius, s * radius, -depth / 2,
            );
            norms.push(
              c, s, 0,
              c, s, 0,
              c, s, 0,
              c, s, 0,
            );
            indecies.push(off + 2, off + 0, off + 1);
            indecies.push(off + 1, off + 3, off + 2);
          }
        }
      }
    }

    //GL
    const world = this.world_;
    const gl = this.gl_;

    this.vertexes_ = world.createArrayBuffer(vertexes, 3)!;
    this.norms_ = world.createArrayBuffer(norms, 3)!;
    this.indecies_ = world.createIndexBuffer(gl.TRIANGLES, indecies)!;
  }
  destroy() {
    this.vertexes_.destroy();
    this.norms_.destroy();
    this.indecies_.destroy();
    this.program_.destoy();
  }
}

const vsSrc = `
attribute vec3 position;
attribute vec3 norm;

uniform mat4 matLocModel;
uniform mat4 matrix;

varying mediump vec3 vPosition;
varying mediump vec3 vNorm;

void main(void) {
  vPosition = (matLocModel * vec4(position, 1.0)).xyz;
  vNorm = (matLocModel * vec4(norm, 0.0)).xyz;
  gl_Position = matrix * vec4(position, 1.0);
}`;

const fsSrc = `
precision mediump float;

varying vec3 vPosition;
varying vec3 vNorm;

uniform vec4 winterPosition;
uniform vec4 winterColor;

uniform vec4 springPosition;
uniform vec4 springColor;

uniform vec4 summerPosition;
uniform vec4 summerColor;

uniform vec4 autumnPosition;
uniform vec4 autumnColor;

/*
vec3 rand(vec3 v) {
  float x = fract(sin(dot(v.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  float y = fract(sin(dot(v.xy, vec2(94.6095, 20.477))) * 54153.0181496);
  float z = fract(sin(dot(v.xy, vec2(35.3341, 75.520))) * 77860.8037050);
  return vec3(x, y, z) * vec3(2.0, 2.0, 2.0) - vec3(1.0, 1.0, 1.0);
}
*/

vec4 calcLight(vec3 lightPosition, vec4 lightColor) {
  vec3 delta = lightPosition - vPosition;
  float d = length(delta);
  vec3 ndelta = delta / d;
  vec3 norm = normalize(vNorm);
  return lightColor * clamp(dot(ndelta, norm), 0.4, 1.0) / pow(d / 15.0, 5.0);
}

void main(void) {
  vec4 color =
    calcLight(winterPosition.xyz, winterColor) +
    calcLight(springPosition.xyz, springColor) +
    calcLight(summerPosition.xyz, summerColor) +
    calcLight(autumnPosition.xyz, autumnColor);
  gl_FragColor = vec4(color.rgb, 1);
}`;