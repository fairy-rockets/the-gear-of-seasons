import World from "../World";
import Moment from "./Moment";
import Program from "../gl/Program";
import ArrayBuffer from "../gl/ArrayBuffer";
import IndexBuffer from "../gl/IndexBuffer";
import { mat4, vec4, ReadonlyVec4, ReadonlyMat4 } from "gl-matrix";

const Scale = Moment.DiscRadius;

export default class Moments {
  private readonly world_: World;
  private readonly gl_: WebGLRenderingContext;
  private readonly program_: Program;
  private readonly vertexes_: ArrayBuffer;
  private readonly texCoords_: ArrayBuffer;
  private readonly indices_: IndexBuffer;
  private readonly matModel_: mat4;
  private readonly mat_: mat4;
  private readonly mouseTmpMat_: mat4;
  private readonly mouseTmpVec_: vec4;
  private readonly momentPosTmpVec_: vec4;
  private models_: Moment[] | null;
  constructor(world: World) {
    this.world_ = world;
    this.gl_ = world.gl;

    const gl = this.gl_;

    const vs = world.compileVertexShader(vsSrc);
    const fs = world.compileFragmentShader(fsSrc);
    this.program_ = world.linkShaders(vs, fs);

    this.vertexes_ = world.createArrayBuffer([
      -1.0,  1.0,  0.0,
      1.0,  1.0,  0.0,
     -1.0, -1.0,  0.0,
      1.0, -1.0,  0.0
    ],3);
    this.texCoords_ = world.createArrayBuffer([
      0.0, 0.0,
      1.0, 0.0,
      0.0, 1.0,
      1.0, 1.0
    ],2);
    this.indices_ = world.createIndexBuffer(gl.TRIANGLES, [
      2, 1, 0,
      1, 2, 3
    ]);

    this.matModel_ = mat4.identity(mat4.create());
    this.mat_ = mat4.identity(mat4.create());

    mat4.scale(this.matModel_, this.matModel_, [Scale, Scale, Scale]);
    
    /** Mouse Handling **/
    this.mouseTmpMat_ = mat4.identity(mat4.create());
    this.mouseTmpVec_ = vec4.create();
    this.momentPosTmpVec_ = vec4.create();

    this.models_ = null;
  }
  set models(ms: Moment[]) {
    if(this.models_) {
      for(let m of this.models_) {
        m.destroy();
      }
    }
    this.models_ = ms;
  }

  render(time: number, matWorld: mat4, mouseX: number, mouseY: number): Moment | null {
    const gl = this.gl_;
    const world = this.world_;
    const gear = world.gear;
    const mat = this.mat_;

    const hw = world.canvas.width/2;
    const hh = world.canvas.height/2;

    const matModel = this.matModel_;

    if(!this.models_) {
      return null;
    }

    let selected: Moment | null = null;

    try {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      this.program_.bind();
      this.vertexes_.bindShader(this.program_, 'position');
      this.texCoords_.bindShader(this.program_, 'textureCoord');
      this.indices_.bind();
      let hit = false;
      for(let m of this.models_) {
        const tex = m.tex;
        if(!tex.ready) {
          continue;
        }
        tex.bindShader(this.program_, 'texture');

        //model matrix
        mat4.identity(mat);
        mat4.translate(mat, mat, [m.x, m.y, 0]);
        mat4.mul(mat, mat, matModel);
        mat4.rotateZ(mat, mat, -gear.angle);
        
        // move to gear space!
        mat4.mul(mat, gear.matrix, mat);
        mat4.mul(mat, matWorld, mat);

        // mouse hit test
        const [dx, dy] = this.calcMousePos_(mat, mouseX, mouseY)
        const hovered = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx * dx + dy * dy) <= 1;
        if(hovered) {
          const v = this.momentPosTmpVec_;
          vec4.set(v, 0, 1, 0, 1);
          vec4.transformMat4(v, v, mat);
          m.setScreenTop((v[0]/v[3]+1)*hw, (1-v[1]/v[3])*hh);
          vec4.set(v, 0, -1, 0, 1);
          vec4.transformMat4(v, v, mat);
          m.setScreenBottom((v[0]/v[3]+1)*hw, (1-v[1]/v[3])*hh);
          selected = m;
        }
        hit = hit || hovered;

        // Lets render!
        gl.uniformMatrix4fv(this.program_.uniformLoc('matrix'), false, mat);
        gl.uniform1i(this.program_.uniformLoc('hovered'), hovered ? 1 : 0);
        this.indices_.render();
      }
      world.cursor = hit;
    } finally {
      gl.disable(gl.BLEND);
      this.vertexes_.unbind();
      this.texCoords_.unbind();
      this.indices_.unbind();
      this.program_.unbind();
    }
    return selected;
  }
  calcMousePos_(mat: ReadonlyMat4, x: number, y: number): [number, number] {
    const tmpMat = this.mouseTmpMat_;
    const tmpVec = this.mouseTmpVec_;
    mat4.set(tmpMat,
      mat[0], mat[1], mat[2], mat[3],
      mat[4], mat[5], mat[6], mat[7],
      0,      0,      -1,     0,
      -x,     -y,     0,      -1
    );
    vec4.set(tmpVec, -mat[12], -mat[13], -mat[14], -mat[15]);
    mat4.invert(tmpMat, tmpMat);
    vec4.transformMat4(tmpVec, tmpVec, tmpMat); /* = (X,Y,z,w) */
    return [tmpVec[0], tmpVec[1]];
  }

  destroy() {
    if(this.models_) {
      for(let m of this.models_) {
        m.destroy();
      }
    }
    this.vertexes_.destroy();
    this.texCoords_.destroy();
    this.indices_.destroy();
    this.program_.destoy();
  }
}

const vsSrc = `
attribute vec3 position;
attribute vec2 textureCoord;
uniform mat4 matrix;
varying vec2 vTextureCoord;

void main(void) {
  vTextureCoord = textureCoord;
  gl_Position = matrix * vec4(position, 1.0);
}
`;

const fsSrc = `
precision mediump float;

uniform bool hovered;
uniform sampler2D texture;
varying vec2 vTextureCoord;

void main(void) {
  vec2 center = vec2(0.5, 0.5);
  float dist = distance(vTextureCoord, center);
  vec4 texColor = texture2D(texture, vTextureCoord);
  vec4 ringColor = hovered ? vec4(1, 1, 1, 1) : vec4(0.2,0.2,0.2,0.5);
  gl_FragColor =
    dist < 0.47 ? texColor :
    dist < 0.5 ? texColor*((0.5-dist)/0.3) + ringColor * (dist/0.3) :
    vec4(0, 0, 0, 0);
}
`;