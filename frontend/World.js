import {mat4, vec3, vec4} from 'gl-matrix';
import IndexBuffer from "./gl/IndexBuffer.js";
import ArrayBuffer from "./gl/ArrayBuffer.js";
import Program from "./gl/Program.js";

import Gear from "./actors/Gear.js";
import Background from './actors/Background.js';

import Layer from "./Layer.js";
import Index from "./layers/Index.js";
import Page from "./layers/Page.js";

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
    this.bg_ = new Background(this);
    /** @type {Layer[]} */
    this.layers_ = [];

    // WorldMatrix
    this.matEye_ = mat4.identity(mat4.create());
    this.matProjection_ = mat4.identity(mat4.create());
    this.matWorld_ = mat4.identity(mat4.create());

    //
    this.cursor_ = false;
    this.canvas_.style.cursor = 'default';
    window.onpopstate = this.onPopState_.bind(this);
  }
  /** @public */
  start() {
    // init OpenGL
    const gl = this.gl_;
    gl.enable(gl.CULL_FACE);

    //gl.enable(gl.DEPTH_TEST);
    //gl.depthFunc(gl.LEQUAL);

    //gl.enable(gl.BLEND);
    //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    mat4.lookAt(this.matEye_, [0, 0, 3], [0, 0, 0], [0, 1, 0]);

    // Start animation
    requestAnimationFrame(this.runner_);
  }
  /** @returns {Gear} */
  get gear() {
    return this.gear_;
  }
  openLayer(pathName) {
    this.openLayer_(true, pathName);
  }
  /** 
   * @param {boolean} modifyHistory 
   * @param {string} pathName
   * @private
   */
  openLayer_(modifyHistory, pathName) {
    if(pathName == '/') {
      this.pushLayer_(modifyHistory, new Index(this));
    }else if(pathName.startsWith('/about-us/')){
  
    }else{
      const url = `/moment${pathName}`;
      const content = fetch(url).then(resp => resp.text());
      this.pushLayer_(modifyHistory, new Page(this, pathName, content));
    }
  }
  /** @param {Layer} next */
  pushLayer(next) {
    this.pushLayer_(true, next);
  }
  /**
   * @param {boolean} modifyHistory
   * @param {Layer} next
   */
  pushLayer_(modifyHistory, next) {
    const layers = this.layers_;
    if(layers.length > 0) {
      const current = layers[layers.length-1];
      current.onDtached();
      document.body.removeChild(current.element);
    }
    layers.push(next);
    document.body.appendChild(next.element);
    next.onAttached();
    if(modifyHistory) {
      if(history.state === null || history.state === undefined) {
        history.replaceState(this.layers_.length, '', next.permalink);
      }else{
        history.pushState(this.layers_.length, '', next.permalink);
      }
    }
  }
  /** @returns {boolean} */
  canPopLayer() {
    return this.layers_.length > 1;
  }
  popLayer() {
    this.popLayer_(true);
  }
  /** 
   * @param {boolean} modifyHistory 
   * @private
   */
  popLayer_(modifyHistory) {
    const layers = this.layers_;
    if(layers.length <= 0) {
      throw new Error("You can't pop empty layer stack.");
    }
    const current = layers.pop();
    current.onDtached();
    document.body.removeChild(current.element);
    current.destroy();

    if(modifyHistory){
      history.back();
    }
    const next = layers[layers.length-1];
    document.body.appendChild(next.element);
    next.onAttached();
  }
  /** @param {PopStateEvent} ev */
  onPopState_(ev) {
    if(ev.state === null || ev.state === undefined) {
      return;
    }
    ev.preventDefault();
    const cnt = ev.state;
    if(cnt === this.layers_.length) {
      return;
    }else if(cnt > this.layers_.length) {
      this.openLayer_(false, location.pathname);
    }else{
      while(cnt < this.layers_.length) {
        this.popLayer_(false);
      }
    }
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
   * @param {boolean} on
   */
  set cursor(on) {
    if(this.cursor_ !== on) {
      this.canvas_.style.cursor = on ? 'pointer' : 'default';
      this.cursor_ = on;
    }
  }
  get cursor() {
    return this.cursor_;
  }
  /**
   * 
   * @param {number} width 
   * @param {number} height 
   */
  onSizeChanged(width, height) {
    const gl = this.gl_;
    const matWorld = this.matWorld_;
    gl.viewport(0, 0, width, height);
    mat4.perspective(this.matProjection_, 45, width / height, 1, 100);
    mat4.multiply(matWorld, this.matProjection_, this.matEye_);
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
    const matWorld = this.matWorld_;
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

    // TODO:
    this.gear_.beforeRender(matWorld);

    // Render
    this.bg_.render(time, matWorld);
    this.gear_.render(matWorld);
    if(this.layers_.length > 0) {
      this.layers_[this.layers_.length-1].render(time, matWorld);
    }

    gl.flush();
  }
  destroy() {
    if(this.layer_) {
      this.layer_.detach();
      this.layer_.destroy();
    }
    this.gear_.destroy();
    this.bg_.destroy();
  }

  /****************************************************************************
   *                              GLSL Helpers                                *
   ****************************************************************************/
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