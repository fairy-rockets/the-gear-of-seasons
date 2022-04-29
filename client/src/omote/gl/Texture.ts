import World from '../World';
import Program from './Program';

export default class Texture {
  private readonly world_: World;
  private readonly gl_: WebGLRenderingContext;
  private readonly url_: string;
  private image_: HTMLImageElement | null;
  private tex_: WebGLTexture | null;
  constructor(world: World, url: string) {
    this.world_ = world;
    this.gl_ = world.gl;
    this.url_ = url;
    this.image_ = new Image();
    this.image_.onload = this.onLoad_.bind(this);
    this.image_.src = url;
    this.tex_ = null;
  }

  onLoad_() {
    const gl = this.gl_;
    this.tex_ = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex_);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image_!);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  get ready(): boolean {
    return this.tex_ != null;
  }

  get image(): HTMLImageElement | null {
    return this.image_;
  }

  bindShader(program: Program, name: string) {
    const gl = this.gl_;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex_);
    gl.uniform1i(program.uniformLoc(name), 0);
  }

  unbind() {
    const gl = this.gl_;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  destroy() {
    const gl = this.gl_;
    gl.deleteTexture(this.tex_);
    this.tex_ = null;
    this.image_ = null;
  }
}