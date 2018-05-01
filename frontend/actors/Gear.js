import World from "../World.js";
import { mat4, vec3, vec4 } from "gl-matrix";

/**
 * @returns {number}
 */
function calcTodaysAngle() {
  const now = new Date();
  const beg = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), 11, 31, 12, 59, 59, 999);
  return Math.PI * 2 * ((now.getTime() - beg.getTime()) / (end.getTime() - beg.getTime()));
}

/**
 * 
 * @param {number} r 
 * @param {number} g 
 * @param {number} b 
 * @returns {number[]}
 */
function rgb(r, g, b) {
  r /= 255.0;
  g /= 255.0;
  b /= 255.0;
  return [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2), 1];
}

const WinterColor = rgb(158, 195, 255);
const SpringColor = rgb(255, 198, 215);
const SummerColor = rgb(82, 219, 70);
const AutumnColor = rgb(221, 105, 51);

export default class Gear {
  /**
   * @param {World} world 
   */
  constructor(world) {
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
    this.angle_ = this.todaysAngle_;
    this.generateModel_(12, 10, 0.6, 1, 0.3);
  }
  /**
   * @param {number} width 
   * @param {number} height 
   * @public
   */
  onSizeChanged(width, height) {
    const aspect = width / height;
    const matModel = this.matModel_;
    const matLoc = this.matLoc_;
    mat4.identity(matModel);
    mat4.identity(matLoc);
    //mat4.rotateY(matModel, matModel, -20/180*Math.PI);
    mat4.scale(matModel, matModel, [10, 10, 10]);
    mat4.translate(matLoc, matLoc, [-1.1 * aspect, 0, -1.5]);
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
  get matrix() {
    return this.matLocModel_;
  }
  /**
   * 
   * @param {mat4} mat 
   */
  render(matWorld) {
    const gl = this.gl_;
    const world = this.world_;

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

    vec4.transformMat4(this.positionOfWinterLightTmp_, this.positionOfWinterLight_, matLocModel);
    vec4.transformMat4(this.positionOfSpringLightTmp_, this.positionOfSpringLight_, matLocModel);
    vec4.transformMat4(this.positionOfSummerLightTmp_, this.positionOfSummerLight_, matLocModel);
    vec4.transformMat4(this.positionOfAutumnLightTmp_, this.positionOfAutumnLight_, matLocModel);


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

      gl.uniform4fv(this.program_.uniformLoc('colorOfWinterLight'), WinterColor);
      gl.uniform4fv(this.program_.uniformLoc('colorOfSummerLight'), SummerColor);
      gl.uniform4fv(this.program_.uniformLoc('colorOfSpringLight'), SpringColor);
      gl.uniform4fv(this.program_.uniformLoc('colorOfAutumnLight'), AutumnColor);

      gl.uniform4fv(this.program_.uniformLoc('positionOfWinterLight'), this.positionOfWinterLight_);
      gl.uniform4fv(this.program_.uniformLoc('positionOfSpringLight'), this.positionOfSpringLight_);
      gl.uniform4fv(this.program_.uniformLoc('positionOfSummerLight'), this.positionOfSummerLight_);
      gl.uniform4fv(this.program_.uniformLoc('positionOfAutumnLight'), this.positionOfAutumnLight_);

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

  /**
   * 
   * @param {number} numCogs 
   * @param {number} numDivs
   * @param {number} innerRadius 
   * @param {number} outerRadius 
   * @param {number} depth
   * @private
   */
  generateModel_(numCogs, numDivs, innerRadius, outerRadius, depth) {
    const pi2 = Math.PI * 2;
    this.positionOfWinterLight_ = vec4.fromValues(+innerRadius, 0, depth, 0);
    this.positionOfSpringLight_ = vec4.fromValues(0, -innerRadius, depth, 0);
    this.positionOfSummerLight_ = vec4.fromValues(-innerRadius, 0, depth, 0);
    this.positionOfAutumnLight_ = vec4.fromValues(0, +innerRadius, depth, 0);
    this.positionOfWinterLightTmp_ = vec4.create();
    this.positionOfSpringLightTmp_ = vec4.create();
    this.positionOfSummerLightTmp_ = vec4.create();
    this.positionOfAutumnLightTmp_ = vec4.create();
    /** @type {number[]} */
    const vertexes = [];
    /** @type {number[]} */
    const indecies = [];
    /** @type {number[]} */
    const norms = [];

    const totalLines = numCogs * numDivs * 2;

    const middleRadius = outerRadius * 0.8;

    for (let i = 0; i < numCogs * 2; ++i) {
      const radius = i % 2 == 0 ? outerRadius : middleRadius;
      for (let j = 0; j <= numDivs; ++j) {
        const angle = pi2 * (i * numDivs + j) / totalLines;

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
          if(i % 2 == 0) {
            indecies.push(off + 1, off + 3, off + 2);
            indecies.push(off + 2, off + 0, off + 1);
            norms.push(
              -s, c, 0,
              -s, c, 0,
              -s, c, 0,
              -s, c, 0
            );
          }else{
            indecies.push(off + 2, off + 3, off + 1);
            indecies.push(off + 1, off + 0, off + 2);
            norms.push(
              s, -c, 0,
              s, -c, 0,
              s, -c, 0,
              s, -c, 0,
            );
          }
        } else {
          const prevAngle = pi2 * (i * numDivs + j - 1) / totalLines;
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

    this.vertexes_ = world.createArrayBuffer(vertexes, 3);
    this.norms_ = world.createArrayBuffer(norms, 3);
    this.indecies_ = world.createIndexBuffer(gl.TRIANGLES, indecies);
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
  vPosition = position;//(matLocModel * vec4(position, 1.0)).xyz;
  vNorm = norm;
  gl_Position = matrix * vec4(position, 1.0);
}`;

const fsSrc = `
precision mediump float;

varying vec3 vPosition;

uniform vec4 positionOfWinterLight;
uniform vec4 colorOfWinterLight;

uniform vec4 positionOfSpringLight;
uniform vec4 colorOfSpringLight;

uniform vec4 positionOfSummerLight;
uniform vec4 colorOfSummerLight;

uniform vec4 positionOfAutumnLight;
uniform vec4 colorOfAutumnLight;

vec4 calcLight(vec3 position, vec4 color) {
  if(vPosition.z > -1.0) {
    float d = distance(position, vPosition);
    return vec4(color.rgb / (1.0+pow(d,4.0)*7.0), color.a);
  } else {
    float r = distance(vPosition.xy, vec2(0, 0));
    float d = distance(position * 5.0, vPosition) / 4.0;
    float mix = clamp(pow(abs(r - 1.0)/3.0, 0.75),0.0,1.0) / pow(d,4.0);

    return vec4(mix * color.rgb, color.a);
  }
}

void main(void) {
  vec4 color =
    calcLight(positionOfWinterLight.xyz, colorOfWinterLight) +
    calcLight(positionOfSpringLight.xyz, colorOfSpringLight) +
    calcLight(positionOfSummerLight.xyz, colorOfSummerLight) +
    calcLight(positionOfAutumnLight.xyz, colorOfAutumnLight);
  gl_FragColor = vec4(1.0);//clamp(color, 0.0, 1.0);
}`;