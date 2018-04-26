export default class ArrayBuffer{
  /**
   * @param {WebGLRenderingContext} gl 
   * @param {WebGLBuffer} buff
   * @param {number} elemSize
   * @param {number} length
   */
  constructor(gl, buff, elemSize, length) {
    this.gl_ = gl;
    this.buff_ = buff;
    this.elemSize = elemSize;
    this.length = length;
  }
  bind() {
    const gl = this.gl_;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buff_);
  }
  /**
   * 
   * @param {WebGLProgram} prog 
   * @param {string} attrName
   */
  bindShader(prog, attrName) {
    const gl = this.gl_;
    const pos = gl.getAttribLocation(prog, attrName);
    if(pos < 0) {
      throw new Error(`Attribute ${attrName} not found.`);
    }
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
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buff_);
  }
}