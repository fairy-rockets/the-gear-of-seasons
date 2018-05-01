import { vec4 } from "gl-matrix";

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

const z = 1.6;
const r = 1;

/**
 * @param {number} angle
 * @returns {vec4}
 */
function fromAngle(angle) {
  angle = angle* Math.PI / 180;
  return vec4.fromValues(Math.cos(angle) * r, -Math.sin(angle) * r, z, 1);
}

export const Winter = {
  color: rgb(158, 195, 255),
  position: fromAngle(0),
};

export const Spring = {
  color: rgb(255, 198, 215),
  position: fromAngle(90),
};

export const Summer = {
  color: rgb(82, 219, 70),
  position: fromAngle(180),
};

export const Autumn = {
  color: rgb(221, 105, 51),
  position: fromAngle(270),
};
