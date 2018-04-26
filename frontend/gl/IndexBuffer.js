export default class IndexBuffer{
  /**
   * @param {WebGLRenderingContext} gl 
   * @param {WebGLBuffer} buff
   * @param {number} length
   */
  constructor(gl, buff, length) {
    this.gl_ = gl;
    this.buff_ = buff;
    this.length = length;
  }
  bind() {
    const gl = this.gl_;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buff_);
  }
  render() {
    const gl = this.gl_;
    gl.drawElements(gl.TRIANGLES, this.length, gl.UNSIGNED_SHORT, 0);
  }
  unbind() {
    const gl = this.gl_;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buff_);
  }
}