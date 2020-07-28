export default class Program {
  private readonly gl_: WebGLRenderingContext;
  private prog_: WebGLProgram | null;
  private readonly attributeLocs_: Map<string, number>;
  private readonly uniformLocs_: Map<string, WebGLUniformLocation>;

  constructor(gl: WebGLRenderingContext, prog: WebGLProgram) {
    this.gl_ = gl;
    this.prog_ = prog;
    this.attributeLocs_ = new Map();
    this.uniformLocs_ = new Map();
  }

  attributeLoc(name: string): number{
    const gl = this.gl_;
    let pos = this.attributeLocs_.get(name)
    if(pos !== undefined) {
      return pos;
    }
    pos = gl.getAttribLocation(this.prog_!, name);
    if(pos < 0) {
      throw new Error(`Attribute ${name} not found.`);
    }
    this.attributeLocs_.set(name, pos);
    return pos;
  }
  uniformLoc(name: string){
    const gl = this.gl_;
    {
      const pos = this.uniformLocs_.get(name);
      if(pos !== undefined) {
        return pos;
      }
    }
    const pos = gl.getUniformLocation(this.prog_!, name);
    if(pos === null) {
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