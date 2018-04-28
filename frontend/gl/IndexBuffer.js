export default class IndexBuffer{
  /**
   * @param {WebGLRenderingContext} gl 
   * @param {number} mode 
   * @param {WebGLBuffer} buff
   * @param {number} length
   */
  constructor(gl, mode, buff, length) {
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
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buff_);
  }
  destroy() {
    const gl = this.gl_;
    gl.deleteBuffer(this.buff_);
  }
}