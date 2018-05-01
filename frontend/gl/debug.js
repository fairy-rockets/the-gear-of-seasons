import { mat4, vec4 } from "gl-matrix";

/**
 * 
 * @param {string} name 
 * @param {mat4} mat 
 */
export function printMatrix(name, mat) {
  console.log(`mat4(${name})= [
  ${mat[0].toFixed(3)} ${mat[4].toFixed(3)} ${mat[8].toFixed(3)} ${mat[12].toFixed(3)}
  ${mat[1].toFixed(3)} ${mat[5].toFixed(3)} ${mat[9].toFixed(3)} ${mat[13].toFixed(3)}
  ${mat[2].toFixed(3)} ${mat[6].toFixed(3)} ${mat[10].toFixed(3)} ${mat[14].toFixed(3)}
  ${mat[3].toFixed(3)} ${mat[7].toFixed(3)} ${mat[11].toFixed(3)} ${mat[15].toFixed(3)}
]`);
}

/**
 * @param {string} name 
 * @param {vec4} vec 
 */
export function printVec(name, vec) {
  console.log(`vec4(${name}) = [${vec[0].toFixed(3)}} ${vec[1].toFixed(3)} ${vec[2].toFixed(3)} ${vec[3].toFixed(3)}]`);
}
