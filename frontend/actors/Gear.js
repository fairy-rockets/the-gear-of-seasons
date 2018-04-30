import World from "../World.js";
import { mat4, vec3, vec4 } from "gl-matrix";

/**
 * @returns {number}
 */
function calcTodaysAngle() {
  const now = new Date();
  const beg = new Date(now.getFullYear(), 1, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), 12, 31, 0, 0, 0, 0);
  return Math.PI * 2 * ((now.getTime() - beg.getTime()) / (end.getTime() - beg.getTime()));
}

/**
 * 
 * @param {number} r 
 * @param {number} g 
 * @param {number} b 
 * @returns {number[]}
 */
function rgb(r,g,b) {
  r /= 255.0;
  g /= 255.0;
  b /= 255.0;
  return [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2), 1];
}

const WinterColor = rgb(158, 195, 255);
const SpringColor = rgb(255, 168, 168);
const SummerColor = rgb(58, 242, 187);
const AutumnColor = rgb(221, 105, 51);

export default class Gear {
  /**
   * @param {World} world 
   */
  constructor(world) {
    this.world_ = world;
    this.gl_ = world.gl;
    const vs = world.compileVertexShader(`
    attribute vec3 position;
    attribute vec3 norm;
    attribute vec4 color;
    uniform mat4 modelMatrix;
    uniform mat4 projMatrix;
    varying mediump vec3 vPosition;
    varying mediump vec4 vColor;
    
    void main(void) {
      vPosition = position;//(modelMatrix * vec4(position, 1.0)).xyz;
      vColor = color;
      gl_Position = projMatrix * vec4(position, 1.0);
    }
    `);
    const fs = world.compileFragmentShader(`
    precision mediump float;

    varying vec3 vPosition;
    varying vec4 vColor;

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
        float d = distance(position * 5.0, vPosition)/4.0;
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
      gl_FragColor = clamp(color * vColor, 0.2, 1.0);
    }
    `);
    this.program_ = world.linkShaders(vs, fs);
    this.modelMat_ = mat4.identity(mat4.create());
    this.angle_ = 0;
    this.tmpMat_ = mat4.identity(mat4.create());
    this.tmpCameraMat_ = mat4.identity(mat4.create());
  }
  init() {
    const gl = this.gl_;
    const world = this.world_;
    this.generateModel(12, 10, 0.6, 1, 0.3);
    this.todaysAngle_ = calcTodaysAngle();
    this.angle_ = this.todaysAngle_;
  }
  /**
   * @param {number} width 
   * @param {number} height 
   */
  onSizeChanged(width, height) {
    const aspect = width / height;
    const modelMat = this.modelMat_;
    mat4.identity(modelMat);
    //mat4.rotateY(modelMat, modelMat, -20/180*Math.PI);
    mat4.scale(modelMat, modelMat, [10, 10, 10]);
    mat4.translate(modelMat, modelMat, [-0.8 * aspect, +0.8, -1.5]);
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
    const mat = this.tmpMat_;
    const cameraMat = this.tmpCameraMat_;

    // calc model matrix
    mat4.identity(cameraMat);
    mat4.rotateZ(cameraMat, cameraMat, this.angle);
    mat4.mul(cameraMat, this.modelMat_, cameraMat);

    // calc final matrix (eye + projection)
    mat4.mul(mat, worldMat, cameraMat);

    vec4.transformMat4(this.positionOfWinterLightTmp_, this.positionOfWinterLight_, cameraMat);
    vec4.transformMat4(this.positionOfSpringLightTmp_, this.positionOfSpringLight_, cameraMat);
    vec4.transformMat4(this.positionOfSummerLightTmp_, this.positionOfSummerLight_, cameraMat);
    vec4.transformMat4(this.positionOfAutumnLightTmp_, this.positionOfAutumnLight_, cameraMat);


    try {
      this.program_.bind();
      this.vertexes_.bindShader(this.program_, 'position');
      this.colors_.bindShader(this.program_, 'color');
      gl.uniformMatrix4fv(this.program_.uniformLoc('modelMatrix'), false, cameraMat);
      gl.uniformMatrix4fv(this.program_.uniformLoc('projMatrix'), false, mat);

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
      this.vertexes_.unbind();
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
    const colors = [];
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
    for (let i = 0; i < numCogs * 2; ++i) {
      for (let j = 0; j < numDivs; ++j) {
        const angle = pi2 * (i * numDivs + j) / totalLines;
        const radius = i % 2 == 0 ? outerRadius : outerRadius * 0.8;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const numVertexes = vertexes.length / 3;
        const current = {
          innerTop: numVertexes + 0,
          innerBottom: numVertexes + 1,
          outerTop: numVertexes + 2,
          outerBottom: numVertexes + 3
        };
        vertexes.push(
          c * innerRadius, s * innerRadius, depth / 2,
          c * innerRadius, s * innerRadius, -depth / 2,
          c * radius, s * radius, depth / 2,
          c * radius, s * radius, -depth / 2
        );
        colors.push(
          1.0, 1.0, 1.0, 1.0,
          0.3, 0.3, 0.3, 1.0,
          1.0, 1.0, 1.0, 1.0,
          0.3, 0.3, 0.3, 1.0,
        );

        if (last) {
          // 内側の壁
          indecies.push(last.innerTop, current.innerTop, current.innerBottom);
          indecies.push(current.innerBottom, last.innerBottom, last.innerTop);
          // シルエット
          indecies.push(current.innerTop, last.innerTop, last.outerTop);
          indecies.push(last.outerTop, current.outerTop, current.innerTop);
          // 外側の壁
          indecies.push(current.outerTop, last.outerTop, last.outerBottom);
          indecies.push(last.outerBottom, current.outerBottom, current.outerTop);

        }
        last = current;
        if (!first) first = current;
      }
    }
    // 円環を閉じる
    {
      const current = first;
      // 内側の壁
      indecies.push(last.innerTop, current.innerTop, current.innerBottom);
      indecies.push(current.innerBottom, last.innerBottom, last.innerTop);
      // シルエット
      indecies.push(current.innerTop, last.innerTop, last.outerTop);
      indecies.push(last.outerTop, current.outerTop, current.innerTop);
      // 外側の壁
      indecies.push(current.outerTop, last.outerTop, last.outerBottom);
      indecies.push(last.outerBottom, current.outerBottom, current.outerTop);
    }

    // background
    {
      const idx = vertexes.length/3;
      vertexes.push(
        -10.0, +10.0,  -3.0,
        +10.0, +10.0,  -3.0,
        -10.0, -10.0,  -3.0,
        +10.0, -10.0,  -3.0
      );
      indecies.push(idx + 2, idx + 1, idx + 0);
      indecies.push(idx + 1, idx + 2, idx + 3);
      colors.push(
        1.0, 1.0, 1.0, 1.0,
        1.0, 1.0, 1.0, 1.0,
        1.0, 1.0, 1.0, 1.0,
        1.0, 1.0, 1.0, 1.0,
      );
    }


    //GL
    const world = this.world_;
    const gl = this.gl_;

    this.vertexes_ = world.createArrayBuffer(vertexes, 3);
    this.colors_ = world.createArrayBuffer(colors, 4);
    this.indecies_ = world.createIndexBuffer(gl.TRIANGLES, indecies);
  }
  destroy() {
    this.vertexes_.destroy();
    this.colors_.destroy();
    this.indecies_.destroy();
    this.program_.destoy();
  }
}