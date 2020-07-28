export default class IndexBuffer{
  private readonly gl_: WebGLRenderingContext;
  private readonly mode_: number;
  private buff_: WebGLBuffer | null;
  public readonly length: number;
  constructor(gl: WebGLRenderingContext, mode: number, buff: WebGLBuffer, length: number) {
    this.gl_ = gl;
    this.mode_ = mode;
    this.buff_ = buff;
    this.length = length;
  }
  bind() {
    const gl = this.gl_;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buff_);
  }
  render() {
    const gl = this.gl_;
    gl.drawElements(this.mode_, this.length, gl.UNSIGNED_SHORT, 0);
  }
  unbind() {
    const gl = this.gl_;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }
  destroy() {
    this.gl_.deleteBuffer(this.buff_);
    this.buff_ = null;
  }
}