import {mat4, vec3, vec4} from 'gl-matrix';
import IndexBuffer from "./gl/IndexBuffer";
import ArrayBuffer from "./gl/ArrayBuffer";
import Program from "./gl/Program";

import Gear from "./actors/Gear";
import Background from './actors/Background';

import Layer from "./Layer";
import Index from "./layers/Index";
import Page from "./layers/Page";

export default class World {
  private readonly canvas_ : HTMLCanvasElement;
  private readonly gl_ : WebGLRenderingContext;
  private readonly runner_: (time: number) => void;
  private readonly gear_: Gear;
  private readonly bg_: Background;
  private readonly layers_: Layer[];
  private readonly matEye_: mat4;
  private readonly matProjection_: mat4;
  private readonly matWorld_: mat4;
  private cursor_: boolean;
  static fromCanvas(canvas: HTMLCanvasElement): World | null {
    const gl = canvas.getContext('webgl2');
    if(!gl) {
      return null;
    }
    return new World(canvas, gl);
  }
  private constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
    this.canvas_ = canvas;
    this.gl_ = gl;
    this.runner_ = this.render_.bind(this);
    this.gear_ = new Gear(this);
    this.bg_ = new Background(this);
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

  public start() {
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

  onSizeChanged(width: number, height: number) {
    const gl = this.gl_;
    const matWorld = this.matWorld_;
    gl.viewport(0, 0, width, height);
    mat4.perspective(this.matProjection_, 45, width / height, 1, 100);
    mat4.multiply(matWorld, this.matProjection_, this.matEye_);
    this.gear_.onSizeChanged(width, height);
  }

  private render_(time: number) {
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
    while(this.layers_.length > 0) {
      const layer: Layer = this.layers_.pop()!;
      layer.onDtached();
      layer.destroy();
    }
    
    this.gear_.destroy();
    this.bg_.destroy();
  }
  /****************************************************************************
   *                              Getter/Setter                               *
   ****************************************************************************/

   get gear(): Gear {
    return this.gear_;
  }

  get aspect(): number {
    return this.canvas_.width / this.canvas_.height;
  }

  get canvas(): HTMLCanvasElement {
    return this.canvas_;
  }

  get gl(): WebGLRenderingContext {
    return this.gl_;
  }

  set cursor(on: boolean) {
    if(this.cursor_ !== on) {
      this.canvas_.style.cursor = on ? 'pointer' : 'default';
      this.cursor_ = on;
    }
  }
  /****************************************************************************
   *                            Layer  Transitions                            *
   ****************************************************************************/
  openLayer(path: string) {
    this.pushLayer(this.createLayer_(path));
  }

  private createLayer_(path: string): Layer {
    if(path === '/') {
      return new Index(this);
    }else if(path.startsWith('/about-us/')){
      const content = fetch('/static/about-us.html').then(resp => resp.text());
      return new Page(this, '/about-us/', content);
    }else{
      const content = fetch(`/moment${path}`).then(resp => resp.text());
      return new Page(this, path, content);
    }
  }

  pushLayer(next: Layer) {
    this.pushLayer_(next);
    const layers = this.layers_;
    const state = history.state;
    const emptyState = state === null || state === undefined;
    if(emptyState) {
      history.replaceState(1, '', next.path);
    } else if(layers.length !== 1) {
      history.pushState(state+1, '', next.path);
    }
  }

  pushLayer_(next: Layer) {
    const layers = this.layers_;
    if(layers.length > 0) {
      const current = layers[layers.length-1];
      current.onDtached();
      document.body.removeChild(current.element);
    }
    layers.push(next);
    document.body.appendChild(next.element);
    next.onAttached();
  }

  canPopLayer(): boolean {
    return this.layers_.length > 1;
  }

  public popLayer() {
    this.popLayer_();
    history.back();
  }

  private popLayer_() {
    const layers = this.layers_;
    if(layers.length < 2) {
      throw new Error(`You can't pop layer stack of length=${layers.length}.`);
    }
    const current = layers.pop()!;
    current.onDtached();
    document.body.removeChild(current.element);
    current.destroy();

    const next = layers[layers.length-1];
    document.body.appendChild(next.element);
    next.onAttached();
  }

  private replaceLayer_(next: Layer) {
    const layers = this.layers_;
    if(layers.length <= 1) {
      throw new Error(`You can't replace layer stack of length=${layers.length}.`);
    }
    const current = layers.pop()!;
    current.onDtached();
    document.body.removeChild(current.element);
    current.destroy();

    layers.push(next);
    document.body.appendChild(next.element);
    next.onAttached();
  }

  onPopState_(ev: PopStateEvent) {
    const layers = this.layers_;
    if(ev.state === null || ev.state === undefined) {
      return;
    }
    ev.preventDefault();
    const cnt = ev.state;
    const path = location.pathname;
    const current = this.layers_[this.layers_.length-1];
    if(current.path === path) {
      return;
    }
    let idx = layers.length-1;
    for(; idx >= 0; --idx) {
      const layer = layers[idx];
      if(layer.path === path) {
        break;
      }
    }
    if(idx >= 0) {
      while(idx < layers.length) {
        this.popLayer_();
      }
    }
    this.pushLayer_(this.createLayer_(path));
  }

  /****************************************************************************
   *                              GLSL Helpers                                *
   ****************************************************************************/

   compileFragmentShader(src: string): WebGLShader {
    const gl = this.gl_;
    return this.compileShader_(gl.FRAGMENT_SHADER, src);
  }

  compileVertexShader(src: string): WebGLShader {
    const gl = this.gl_;
    return this.compileShader_(gl.VERTEX_SHADER, src);
  }

  private compileShader_(type: number, src: string): WebGLShader {
    const gl = this.gl_;
    const shader = gl.createShader(type)!;
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
      throw new Error(err ? err : undefined);
    }
  }

  linkShaders(vs: WebGLShader, fs: WebGLShader): Program {
    const gl = this.gl_;
    const program = gl.createProgram()!;
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
      throw new Error(err ? err : undefined);
    }
  }

  createIndexBuffer(mode: number, data: Uint16Array|number[]): IndexBuffer {
    const gl = this.gl_;
    const buff = gl.createBuffer()!;
    if(data instanceof Array) {
      data = new Uint16Array(data);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buff);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    return new IndexBuffer(gl, mode, buff, data.length);
  }

  createArrayBuffer(data: Float32Array|number[], elemSize: number): ArrayBuffer {
    const gl = this.gl_;
    const buff = gl.createBuffer()!;
    if(data instanceof Array) {
      data = new Float32Array(data);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buff);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return new ArrayBuffer(gl, buff, elemSize, data.length);
  }
}