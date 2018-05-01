import { vec3 } from "gl-matrix";

/**
 * 
 * @param {number} r 
 * @param {number} g 
 * @param {number} b 
 * @returns {number[]}
 */
function rgb(r,g,b) {
  r /= 255.0;
  g /= 255.0;
  b /= 255.0;
  return [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2), 1];
}

export const Winter = {
  color: rgb(158, 195, 255),
  position: vec3.fromValues(+1, +0, +0.2),
};

export const Spring = {
  color: rgb(255, 198, 215),
  position: vec3.fromValues(+0, -1, +0.2),
};

export const Summer = {
  color: rgb(82, 219, 70),
  position: vec3.fromValues(-1, +0, +0.2),
};

export const Autumn = {
  color: rgb(221, 105, 51),
  position: vec3.fromValues(+0, +1, +0.2),
};
