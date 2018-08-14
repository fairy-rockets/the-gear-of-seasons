export default class Program {
  /**
   * 
   * @param {WebGLRenderingContext} gl 
   * @param {WebGLProgram} prog 
   */
  constructor(gl, prog) {
    this.gl_ = gl;
    this.prog_ = prog;
    /** 
     * @type {Map<string, number>}
     * @private
     */
    this.attributeLocs_ = new Map();
    /** 
     * @type {Map<string, number>}
     * @private
     */
    this.uniformLocs_ = new Map();
  }
  /**
   * 
   * @param {string} name 
   * @returns {number}
   */
  attributeLoc(name){
    const gl = this.gl_;
    if(this.attributeLocs_.has(name)) {
      return this.attributeLocs_.get(name);
    }
    const pos = gl.getAttribLocation(this.prog_, name);
    if(pos < 0) {
      throw new Error(`Attribute ${name} not found.`);
    }
    this.attributeLocs_.set(name, pos);
    return pos;
  }
  /**
   * 
   * @param {string} name 
   * @returns {number}
   */
  uniformLoc(name){
    const gl = this.gl_;
    if(this.uniformLocs_.has(name)) {
      return this.uniformLocs_.get(name);
    }
    const pos = gl.getUniformLocation(this.prog_, name);
    if(pos < 0) {
      throw new Error(`Uniform ${name} not found.`);
    }
    this.uniformLocs_.set(name, pos);
    return pos;
  }
  bind() {
    const gl = this.gl_;
    gl.useProgram(this.prog_);
  }
  unbind() {
    const gl = this.gl_;
    gl.useProgram(null);
  }
  destoy(){
    this.gl_.deleteProgram(this.prog_);
    this.prog_ = null;
  }
}