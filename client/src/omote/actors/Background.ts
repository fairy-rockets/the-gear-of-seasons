import World from '../World';
import Program from '../gl/Program';
import ArrayBuffer from '../gl/ArrayBuffer';
import IndexBuffer from '../gl/IndexBuffer';
import { mat4, vec4, ReadonlyMat4 } from 'gl-matrix';
import { Winter, Spring, Summer, Autumn } from './Seasons';

export default class Background {
  private readonly world_: World;
  private readonly gl_: WebGLRenderingContext;
  private readonly program_: Program;
  private vertexes_: ArrayBuffer;
  private norms_: ArrayBuffer;
  private indices_: IndexBuffer;
  private readonly matModel_: mat4;
  private readonly matLoc_: mat4;
  private readonly matLocModelTmp_: mat4;
  private readonly matTmp_: mat4;
  constructor(world: World) {
    this.world_ = world;
    this.gl_ = world.gl;

    const gl = this.gl_;

    const vs = world.compileVertexShader(vsSrc);
    const fs = world.compileFragmentShader(fsSrc);
    this.program_ = world.linkShaders(vs, fs);

    this.vertexes_ = world.createArrayBuffer([
      -200.0, +200.0,  0.00,
      +200.0, +200.0,  0.00,
      -200.0, -200.0,  0.00,
      +200.0, -200.0,  0.00
    ],3);
    this.norms_ = world.createArrayBuffer([
      0,0,1,
      0,0,1,
      0,0,1,
      0,0,1,
    ],3);
    this.indices_ = world.createIndexBuffer(gl.TRIANGLES, [
      2, 1, 0,
      1, 2, 3
    ]);

    /** Matrix **/
    this.matModel_ = mat4.identity(mat4.create());
    //mat4.rotateY(this.matModel_, this.matModel_, -Math.PI/4);

    this.matLoc_ = mat4.identity(mat4.create());
    mat4.translate(this.matLoc_, this.matLoc_, [-2, 0, -5]);

    this.matLocModelTmp_ = mat4.identity(mat4.create());
    this.matTmp_ = mat4.identity(mat4.create());
  }
  render(time: number, matWorld: ReadonlyMat4) {
    const gl = this.gl_;
    const world = this.world_;
    const matTmp = this.matTmp_;
    const matLocModel = this.matLocModelTmp_;

    try {
      this.program_.bind();
      this.vertexes_.bindShader(this.program_, 'position');
      //this.norms_.bindShader(this.program_, 'norm'); //TODO: unused

      this.indices_.bind();
      mat4.identity(matLocModel);
      mat4.mul(matLocModel, this.matLoc_, matLocModel);
      mat4.mul(matLocModel, this.matModel_, matLocModel);

      mat4.mul(matTmp, matWorld, matLocModel);

      gl.uniformMatrix4fv(this.program_.uniformLoc('matLocModel'), false, matLocModel);
      gl.uniformMatrix4fv(this.program_.uniformLoc('matrix'), false, matTmp);

      gl.uniform1f(this.program_.uniformLoc('time'), time);

      gl.uniform4fv(this.program_.uniformLoc('winterColor'), Winter.color);
      gl.uniform4fv(this.program_.uniformLoc('springColor'), Spring.color);
      gl.uniform4fv(this.program_.uniformLoc('summerColor'), Summer.color);
      gl.uniform4fv(this.program_.uniformLoc('autumnColor'), Autumn.color);

      gl.uniform4fv(this.program_.uniformLoc('winterPosition'), world.gear.winterLightPos);
      gl.uniform4fv(this.program_.uniformLoc('springPosition'), world.gear.springLightPos);
      gl.uniform4fv(this.program_.uniformLoc('summerPosition'), world.gear.summerLightPos);
      gl.uniform4fv(this.program_.uniformLoc('autumnPosition'), world.gear.autumnLightPos);

      this.indices_.render();
    } finally {
      this.norms_.unbind();
      this.vertexes_.unbind();
      this.indices_.unbind();
      this.program_.unbind();
    }
  }
  destroy() {
    this.norms_.destroy();
    this.vertexes_.destroy();
    this.indices_.destroy();
    this.program_.destoy();
  }
}

const vsSrc = `
attribute vec3 position;

uniform mat4 matLocModel;
uniform mat4 matrix;

varying mediump vec3 vPosition;

void main(void) {
  vPosition = (matLocModel * vec4(position, 1.0)).xyz;
  gl_Position = matrix * vec4(position, 1.0);
}
`;
const fsSrc = `
precision mediump float;

uniform float time;
varying vec3 vPosition;

uniform vec4 winterPosition;
uniform vec4 winterColor;

uniform vec4 springPosition;
uniform vec4 springColor;

uniform vec4 summerPosition;
uniform vec4 summerColor;

uniform vec4 autumnPosition;
uniform vec4 autumnColor;

// https://stackoverflow.com/questions/4200224/random-noise-functions-for-glsl
float rand(vec2 co) {
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

// from https://wgld.org/d/webgl/w025.html
const int   oct  = 8;
const float per  = 0.5;
const float PI   = 3.1415926;

// 補間関数
float interpolate(float a, float b, float x){
	float f = (1.0 - cos(x * PI)) * 0.5;
	return a * (1.0 - f) + b * f;
}

// 補間乱数
float irnd(vec2 p){
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec4 v = vec4(
          rand(vec2(i.x,       i.y      )),
				  rand(vec2(i.x + 1.0, i.y      )),
				  rand(vec2(i.x,       i.y + 1.0)),
				  rand(vec2(i.x + 1.0, i.y + 1.0)));
	return interpolate(interpolate(v.x, v.y, f.x), interpolate(v.z, v.w, f.x), f.y);
}

// ノイズ生成
float noise(vec2 p){
	float t = 0.0;
	for(int i = 0; i < oct; i++){
		float freq = pow(2.0, float(i));
		float amp  = pow(per, float(oct - i));
		t += irnd(vec2(p.x / freq, p.y / freq)) * amp;
	}
	return t;
}

vec4 calcLight(vec3 lightPosition, vec4 lightColor) {
  vec3 delta = lightPosition - vPosition;
  float d = length(delta);
  vec3 ndelta = normalize(delta);
  return lightColor * 5.0 / pow(d, 1.2);
}

void main(void) {
  float n = noise(gl_FragCoord.xy + vec2(30000.0 - time / 80.0, 30000.0 - time / 60.0));
  vec3 cloud1 = vec3(pow(n, 3.0) * 0.7);

  n = noise(gl_FragCoord.xy + vec2(-time / 150.0, time / 120.0));
  vec3 cloud2 = vec3(45.0/255.0, 60.0/355.0, 109.0/255.0) * pow(n, 1.0) * 0.3;

  vec4 lightColor =
    calcLight(winterPosition.xyz, winterColor) +
    calcLight(springPosition.xyz, springColor) +
    calcLight(summerPosition.xyz, summerColor) +
    calcLight(autumnPosition.xyz, autumnColor);

  gl_FragColor = vec4(cloud1 + cloud2, 1.0) + lightColor;
}
`;
