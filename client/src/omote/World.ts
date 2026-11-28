import {mat4} from 'gl-matrix';
import { kCamera } from './WorldConstant';
import IndexBuffer from './gl/IndexBuffer';
import ArrayBuffer from './gl/ArrayBuffer';
import Program from './gl/Program';

import Gear from './actors/Gear';
import Background from './actors/Background';

import Layer, { Landing } from './Layer';
import Index from './layers/Index';
import MomentPage from './layers/MomentPage';
import StaticPage from './layers/StaticPage';
import * as analytics from './Analytics';

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
  // サーバが最初に配信した URL と、そのとき <head> に入れてきた SSR のタグ。
  private readonly initialPath_: string;
  private readonly siteTitle_: string;
  private readonly ssrHead_: Element[];
  // 最後の遷移がまだ page_view を送っていなければ、その遷移の nav_via。
  // 最上位のレイヤの題が決まったら送る。次の遷移で上書きされたら、そのページは見られていない。
  private pendingVia_: analytics.NavVia | null;
  static fromCanvas(canvas: HTMLCanvasElement, iconCapture = false): World | null {
    const gl = canvas.getContext('webgl2');
    if(!gl) {
      return null;
    }
    return new World(canvas, gl, iconCapture);
  }
  private constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext, private readonly iconCapture_: boolean) {
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

    this.initialPath_ = location.pathname;
    this.siteTitle_ = document.body.dataset['siteTitle'] ?? document.title;
    this.ssrHead_ = Array.from(document.head.querySelectorAll(
      'meta[property^="og:"], meta[name^="twitter:"], meta[name="description"], link[rel="canonical"]'
    ));

    this.pendingVia_ = null;

    if (!this.iconCapture_) {
      window.onpopstate = this.onPopState_.bind(this);
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

    mat4.lookAt(this.matEye_, [0, 0, kCamera.eyeZ], [0, 0, 0], [0, 1, 0]);

    // Start animation
    requestAnimationFrame(this.runner_);
  }

  onSizeChanged(width: number, height: number) {
    const gl = this.gl_;
    const matWorld = this.matWorld_;
    gl.viewport(0, 0, width, height);
    mat4.perspective(this.matProjection_, kCamera.fovY, width / height, 1, 100);
    mat4.multiply(matWorld, this.matProjection_, this.matEye_);
    if (!this.iconCapture_) {
      this.gear_.onSizeChanged(width, height);
    }
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

  // 投影+視点行列(proj * eye)。歯車中心のスクリーン座標算出などに使う。
  get matWorld(): mat4 {
    return this.matWorld_;
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
  get siteTitle(): string {
    return this.siteTitle_;
  }

  /****************************************************************************
   *                           <head> と page_view                            *
   ****************************************************************************/

  /** 遷移の最後に 1 回だけ呼ぶ。新しい最上位のレイヤを反映し、その page_view を送るか待つ。 */
  private showTop_(via: analytics.NavVia) {
    this.pendingVia_ = via;
    this.applyTop_();
  }

  /** 本文は非同期に届くので、届いた時点でまだ最上位なら反映する。 */
  notifyLoaded(layer: Layer) {
    const layers = this.layers_;
    if (layers.length > 0 && layers[layers.length-1] === layer) {
      this.applyTop_();
    }
  }

  /**
   * <head> をスタック最上位のレイヤから導出し、題が決まっていれば page_view を送る。
   *
   * title はレイヤが持っている値をそのまま使う。SSR の og: や description は、
   * 最初に配信された URL に居る間だけ正しいので、他のレイヤに移ったら外す。
   * (外に出したまま古い値を晒すより、無くて <title> と URL に落ちる方が安全)
   */
  private applyTop_() {
    const layers = this.layers_;
    if (layers.length === 0) {
      return;
    }
    const top = layers[layers.length-1];
    document.title = top.title;
    const valid = top.path === this.initialPath_;
    for (const el of this.ssrHead_) {
      if (valid && !el.isConnected) {
        document.head.appendChild(el);
      } else if (!valid && el.isConnected) {
        el.remove();
      }
    }
    // 遷移の直後(showTop_)は、Page の本文がまだ届いておらず題が決まっていないことがある。
    // そのときは送らずに待ち、本文が届いたとき(notifyLoaded)にもう一度ここを通る。
    if (this.pendingVia_ !== null && top.titleKnown) {
      // UTM などのクエリを付けるのは開いたときの 1 回だけ。歯車のレイヤは使い回すので、
      // 閉じて戻ってきたときにも付けると、流入元をもう一度数えさせてしまう。
      const location = this.pendingVia_ === 'landing' ? top.landingHref : top.href;
      const via = this.pendingVia_;
      this.pendingVia_ = null;
      analytics.pageView(location, top.title, via);
      top.onPageViewSent(via);
    }
  }

  /****************************************************************************
   *                            Layer  Transitions                            *
   ****************************************************************************/
  /** 開いた URL のレイヤを作る。main から最初に 1 回だけ呼ぶ。 */
  openLandingLayer() {
    // pushLayer の replaceState でクエリが消える前に読む。
    const landing: Landing = { href: location.href, title: document.title };
    this.pushLayer(this.createLayer_(location.pathname, landing), 'landing');
  }

  openLayer(path: string, via: analytics.NavVia) {
    this.pushLayer(this.createLayer_(path), via);
  }

  private createLayer_(path: string, landing?: Landing): Layer {
    if (path === '/') {
      return new Index(this, landing);
    } else if (path.startsWith('/about-us/')) {
      const content = StaticPage.fetchBody('/static/about-us.html');
      return new StaticPage(this, '/about-us/', content, landing);
    } else if (path.startsWith('/pickup/')) {
      const content = StaticPage.fetchBody('/pickup/body');
      return new StaticPage(this, '/pickup/', content, landing);
    } else if (path.startsWith('/shop/')) {
      const content = StaticPage.fetchBody('/static/shop.html');
      return new StaticPage(this, '/shop/', content, landing);
    } else {
      const content = MomentPage.fetchBody(`/moment${path}`);
      return new MomentPage(this, path, content, landing);
    }
  }

  pushLayer(next: Layer, via: analytics.NavVia) {
    this.pushLayer_(next);
    const layers = this.layers_;
    const state = history.state;
    const emptyState = state === null || state === undefined;
    if (emptyState) {
      history.replaceState(1, '', next.path);
    } else if (layers.length !== 1) {
      history.pushState(state+1, '', next.path);
    }
    this.showTop_(via);
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

  /**
   * 歯車(トップ)へ移る。
   *
   * 前のページに戻るのではなく、`/` へ進む新しい履歴エントリを作る。
   * 前のページに戻りたいときはブラウザの戻るを使う(#24)。
   * スタックに Index があれば作り直さずにそこまで下ろす(歯車の回転位置を保つ)。
   */
  openTop(via: analytics.NavVia) {
    const layers = this.layers_;
    const idx = layers.map(layer => layer.path).lastIndexOf('/');
    if (idx < 0) {
      // モーメントの URL に直接来たときは、スタックに Index が無い。
      this.openLayer('/', via);
      return;
    }
    if (idx === layers.length-1) {
      return;
    }
    this.popLayersTo_(idx+1);
    history.pushState((history.state ?? 0)+1, '', '/');
    this.showTop_(via);
  }

  /**
   * スタックを length 枚になるまで上から外し、残った最上位を付け直す。
   * 途中のレイヤは付け直さない(onAttached を呼ばない)。最上位になったときの処理(engagement を
   * 始めるなど)を、見られていないレイヤでしてしまうため。最上位でないレイヤは document から外れている。
   */
  private popLayersTo_(length: number) {
    const layers = this.layers_;
    if (length < 1 || layers.length <= length) {
      throw new Error(`Cannot pop a layer stack of length ${layers.length} down to ${length}.`);
    }
    const current = layers.pop()!;
    current.onDetached();
    document.body.removeChild(current.element);
    current.destroy();
    while (layers.length > length) {
      layers.pop()!.destroy();
    }

    const next = layers[layers.length-1];
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
      // 戻り先のレイヤは作り直さずにそのまま使う(Index なら歯車の回転位置が残る)。
      // 最上位が戻り先なら上で return しているので、戻り先は最上位より下にある。
      this.popLayersTo_(idx+1);
      this.showTop_('history');
      return;
    }
    this.pushLayer_(this.createLayer_(path));
    this.showTop_('history');
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
