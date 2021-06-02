import Program from "./Program";

export default class ArrayBuffer{
  private readonly gl_: WebGLRenderingContext;
  private buff_: WebGLBuffer | null;
  public readonly elemSize: number;
  public readonly length: number;
  constructor(gl: WebGLRenderingContext, buff: WebGLBuffer, elemSize: number, length: number) {
    this.gl_ = gl;
    this.buff_ = buff;
    this.elemSize = elemSize;
    this.length = length;
  }
  bind() {
    const gl = this.gl_;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buff_);
  }
  bindShader(prog: Program, attrName: string) {
    const gl = this.gl_;
    const pos = prog.attributeLoc(attrName);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buff_);
    gl.vertexAttribPointer(pos, this.elemSize, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(pos);
  }
  render() {
    const gl = this.gl_;
    gl.drawElements(gl.TRIANGLE_STRIP, this.length, gl.UNSIGNED_SHORT, 0);
  }
  unbind() {
    const gl = this.gl_;
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  destroy() {
    this.gl_.deleteBuffer(this.buff_);
    this.buff_ = null;
  }
}