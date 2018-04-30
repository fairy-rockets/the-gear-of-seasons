import {mat4, vec3, vec4} from 'gl-matrix';
import IndexBuffer from "./gl/IndexBuffer.js";
import ArrayBuffer from "./gl/ArrayBuffer.js";
import Program from "./gl/Program.js";

import Gear from "./actors/Gear.js";
import Layer from "./Layer.js";

export default class World {
  /**
   * @param {HTMLCanvasElement} canvas 
   * @returns {World}
   */
  static fromCanvas(canvas) {
    const gl = canvas.getContext('webgl');
    if(!gl) {
      return null;
    }
    return new World(canvas, gl);
  }
  /**
   * @param {HTMLCanvasElement} canvas 
   * @param {WebGLRenderingContext} gl 
   * @private
   */
  constructor(canvas, gl) {
    this.canvas_ = canvas;
    this.gl_ = gl;
    this.runner_ = this.render_.bind(this);
    this.gear_ = new Gear(this);
    /** @type {Layer} */
    this.layer_ = null;

    // WorldMatrix
    this.cameraMat_ = mat4.identity(mat4.create());
    this.projMat_ = mat4.identity(mat4.create());
    this.mat_ = mat4.identity(mat4.create());
  }
  /** @public */
  start() {
    this.init_();
    requestAnimationFrame(this.runner_);
  }
  /** @returns {Gear} */
  get gear(){
    return this.gear_;
  }
  /** @param {Layer} layer */
  set layer(layer) {
    this.layer_ = layer;
  }
  /** @returns {number} */
  get aspect() {
    return this.canvas_.width / this.canvas_.height;
  }
  /** @returns {HTMLCanvasElement} */
  get canvas() {
    return this.canvas_;
  }
  /** @returns {WebGLRenderingContext} */
  get gl() {
    return this.gl_;
  }
  /**
   * @private
   */
  init_() {
    const gl = this.gl_;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    
    mat4.lookAt(this.cameraMat_, [0, 0, 3], [0, 0, 0], [0, 1, 0]);
    this.gear_.init();
  }
  /**
   * 
   * @param {number} width 
   * @param {number} height 
   */
  onSizeChanged(width, height) {
    const gl = this.gl_;
    const worldMat = this.mat_;
    gl.viewport(0, 0, width, height);
    mat4.perspective(this.projMat_, 45, width / height, 1, 100);
    mat4.multiply(worldMat, this.projMat_, this.cameraMat_);
    this.gear_.onSizeChanged(width, height);
  }
  /**
   * @param {number} time 
   * @private
   */
  render_(time) {
    requestAnimationFrame(this.runner_);
    const gl = this.gl_;
    const canvas = this.canvas_;
    const worldMat = this.mat_;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
  if(canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      this.onSizeChanged(width, height);
    }
    // canvasを初期化する色を設定する
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    // canvasを初期化する際の深度を設定する
    gl.clearDepth(1.0);
    // canvasを初期化
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.gear_.render(worldMat);

    if(this.layer_) {
      this.layer_.render(time, worldMat);
    }

    gl.flush();
  }
  /**
   * @param {string} src 
   * @returns {WebGLShader}
   */
  compileFragmentShader(src) {
    const gl = this.gl_;
    return this.compileShader_(gl.FRAGMENT_SHADER, src);
  }
  /**
   * @param {string} src 
   * @returns {WebGLShader}
   */
  compileVertexShader(src) {
    const gl = this.gl_;
    return this.compileShader_(gl.VERTEX_SHADER, src);
  }
  /**
   * @param {number} type
   * @param {string} src 
   * @private
   * @returns {WebGLShader}
   */
  compileShader_(type, src) {
    const gl = this.gl_;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if(gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
        return shader;
    }else{
      const err = gl.getShaderInfoLog(shader);
      if(type === gl.VERTEX_SHADER) {
        console.error('Error while compiling vertex shader:', src, err);
      }else if(type === gl.FRAGMENT_SHADER){
        console.error('Error while compiling fragment shader:', src, err);
      }else{
        console.error(`Error while compiling unknown shader type(${type}):`, src, err);
      }
      throw new Error(err);
      return null;
    }
  }
  /**
   * @param {WebGLShader} vs
   * @param {WebGLShader} fs
   * @returns {Program}
   */
  linkShaders(vs, fs) {
    const gl = this.gl_;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  if(gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return new Program(gl, program);
    }else{
      const err = gl.getProgramInfoLog(program);
      console.error('Error while linking shaders:', err);
      throw new Error(err);
      return null;
    }
  }
  /**
   * @param {Uint16Array|number[]} data 
   * @param {number} mode
   * @returns {IndexBuffer}
   */
  createIndexBuffer(mode, data) {
    const gl = this.gl_;
    const buff = gl.createBuffer();
    if(data instanceof Array) {
      data = new Uint16Array(data);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buff);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    return new IndexBuffer(gl, mode, buff, data.length);
  }
  /**
   * @param {Float32Array|number[]} data
   * @param {number} elemSize 
   * @returns {ArrayBuffer}
   */
  createArrayBuffer(data, elemSize) {
    const gl = this.gl_;
    const buff = gl.createBuffer();
    if(data instanceof Array) {
      data = new Float32Array(data);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buff);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return new ArrayBuffer(gl, buff, elemSize, data.length);
  }
}