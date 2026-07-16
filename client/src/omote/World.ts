import {mat4} from 'gl-matrix';
import IndexBuffer from './gl/IndexBuffer';
import ArrayBuffer from './gl/ArrayBuffer';
import Program from './gl/Program';

import Gear from './actors/Gear';
import Background from './actors/Background';

import Layer from './Layer';
import Index from './layers/Index';
import Page from './layers/Page';

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
  private readonly lantern_: HTMLDivElement;
  private readonly lanternButton_: HTMLButtonElement;
  private readonly lanternMenu_: HTMLElement;
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

    // ランタン（道しるべ）。レイヤに関係なく常に画面左下に灯す。
    this.lantern_ = document.createElement('div');
    this.lantern_.className = 'lantern';
    this.lantern_.innerHTML = lanternSrc;
    this.lanternButton_ = this.lantern_.querySelector<HTMLButtonElement>('.lantern-button')!;
    this.lanternMenu_ = this.lantern_.querySelector<HTMLElement>('.lantern-menu')!;
    this.lanternButton_.addEventListener('click', this.onLanternButtonClick_.bind(this));
    for (const a of Array.from(this.lanternMenu_.querySelectorAll<HTMLAnchorElement>('a[data-internal]'))) {
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        this.closeLanternMenu_();
        this.openLayer(a.getAttribute('href')!);
      });
    }
    document.addEventListener('mouseup', this.onDocumentMouseUp_.bind(this), false);
    document.body.appendChild(this.lantern_);
  }

  private onLanternButtonClick_(ev: MouseEvent) {
    ev.stopPropagation();
    if (this.lanternMenu_.classList.contains('open')) {
      this.closeLanternMenu_();
    } else {
      this.openLanternMenu_();
    }
  }

  private openLanternMenu_() {
    this.lanternMenu_.classList.add('open');
    this.lanternMenu_.setAttribute('aria-hidden', 'false');
    this.lanternButton_.setAttribute('aria-expanded', 'true');
  }

  private closeLanternMenu_() {
    this.lanternMenu_.classList.remove('open');
    this.lanternMenu_.setAttribute('aria-hidden', 'true');
    this.lanternButton_.setAttribute('aria-expanded', 'false');
  }

  private onDocumentMouseUp_(ev: MouseEvent) {
    if (!this.lantern_.contains(ev.target as Node)) {
      this.closeLanternMenu_();
    }
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
      layer.onDetached();
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
    if (path === '/') {
      return new Index(this);
    } else if (path.startsWith('/about-us/')) {
      const content = fetch('/static/about-us.html').then(resp => resp.text());
      return new Page(this, '/about-us/', content);
    } else if (path.startsWith('/pickup/')) {
      const content = fetch('/pickup/body').then(resp => resp.text());
      return new Page(this, '/pickup/', content);
    } else if (path.startsWith('/shop/')) {
      const content = fetch('/static/shop.html').then(resp => resp.text());
      return new Page(this, '/shop/', content);
    } else {
      const content = fetch(`/moment${path}`).then(resp => resp.text());
      return new Page(this, path, content);
    }
  }

  pushLayer(next: Layer) {
    this.pushLayer_(next);
    const layers = this.layers_;
    const state = history.state;
    const emptyState = state === null || state === undefined;
    if (emptyState) {
      history.replaceState(1, '', next.path);
    } else if (layers.length !== 1) {
      history.pushState(state+1, '', next.path);
    }
  }

  pushLayer_(next: Layer) {
    const layers = this.layers_;
    if (layers.length > 0) {
      const current = layers[layers.length-1];
      current.onDetached();
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
    if (layers.length < 2) {
      throw new Error(`You can't pop layer stack of length=${layers.length}.`);
    }
    const current = layers.pop()!;
    current.onDetached();
    document.body.removeChild(current.element);
    current.destroy();

    const next = layers[layers.length-1];
    document.body.appendChild(next.element);
    next.onAttached();
  }

  private replaceLayer_(next: Layer) {
    const layers = this.layers_;
    if (layers.length <= 1) {
      throw new Error(`You can't replace layer stack of length=${layers.length}.`);
    }
    const current = layers.pop()!;
    current.onDetached();
    document.body.removeChild(current.element);
    current.destroy();

    layers.push(next);
    document.body.appendChild(next.element);
    next.onAttached();
  }

  onPopState_(ev: PopStateEvent) {
    const layers = this.layers_;
    if (ev.state === null || ev.state === undefined) {
      return;
    }
    ev.preventDefault();
    const cnt = ev.state;
    const path = location.pathname;
    const current = this.layers_[this.layers_.length-1];
    if (current.path === path) {
      return;
    }
    let idx = layers.length-1;
    for (; idx >= 0; --idx) {
      const layer = layers[idx];
      if(layer.path === path) {
        break;
      }
    }
    if (idx >= 0) {
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
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        return shader;
    } else {
      const err = gl.getShaderInfoLog(shader);
      if (type === gl.VERTEX_SHADER) {
        console.error('Error while compiling vertex shader:', src, err);
      } else if (type === gl.FRAGMENT_SHADER) {
        console.error('Error while compiling fragment shader:', src, err);
      } else {
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
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return new Program(gl, program);
    } else {
      const err = gl.getProgramInfoLog(program);
      console.error('Error while linking shaders:', err);
      throw new Error(err ? err : undefined);
    }
  }

  createIndexBuffer(mode: number, data: Uint16Array|number[]): IndexBuffer {
    const gl = this.gl_;
    const buff = gl.createBuffer()!;
    if (data instanceof Array) {
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
    if (data instanceof Array) {
      data = new Float32Array(data);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buff);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return new ArrayBuffer(gl, buff, elemSize, data.length);
  }
}

const lanternSrc = `
<button class="lantern-button" aria-label="メニューをひらく" aria-expanded="false">
  <svg class="lantern-icon" viewBox="0 0 64 64" width="2.5em" height="2.5em" aria-hidden="true">
    <line x1="32" y1="2" x2="32" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <polygon points="32,10 8,26 56,26" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="12" y="26" width="40" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="2.5"/>
    <rect x="20" y="34" width="10" height="14" rx="1" fill="#ffb769" stroke="currentColor" stroke-width="1.5"/>
    <rect x="34" y="34" width="10" height="14" rx="1" fill="#ffb769" stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="56" x2="52" y2="56" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  </svg>
  <span class="lantern-label">あかり</span>
</button>
<nav class="lantern-menu" aria-hidden="true">
  <a href="/pickup/" data-internal>えらんだ絵</a>
  <a href="/shop/" data-internal>お店</a>
  <a href="https://www.pixiv.net/users/101966442" target="_blank" rel="noopener">pixiv</a>
  <a href="https://www.instagram.com/nagi.yomiya/" target="_blank" rel="noopener">Instagram</a>
  <a href="https://ci-en.net/creator/26041" target="_blank" rel="noopener">ci-en</a>
  <a href="https://www.youtube.com/@fairy-rockets" target="_blank" rel="noopener">YouTube</a>
</nav>
`;
