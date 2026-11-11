import { vec4 } from 'gl-matrix';

function rgb(r: number,g: number,b: number): [number, number, number, number] {
  r /= 255.0;
  g /= 255.0;
  b /= 255.0;
  return [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2), 1];
}

const kLightZ = 1.5;
const kLightRadius = 1.5;

function fromAngle(angle: number): vec4 {
  angle = angle* Math.PI / 180;
  return vec4.fromValues(Math.cos(angle) * kLightRadius, -Math.sin(angle) * kLightRadius, kLightZ, 1);
}

export const kWinter = {
  color: rgb(158, 195, 255),
  position: fromAngle(0),
};

export const kSpring = {
  color: rgb(255, 198, 215),
  position: fromAngle(90),
};

export const kSummer = {
  color: rgb(82, 219, 70),
  position: fromAngle(180),
};

export const kAutumn = {
  color: rgb(221, 105, 51),
  position: fromAngle(270),
};
