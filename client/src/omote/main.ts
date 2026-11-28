import World from './World';
import * as analytics from './Analytics';

let world: World | null = null;

function enableIconCapture(world: World) {
  const canvas = world.canvas;
  canvas.classList.add('icon-capture');
  world.gear.placeForIconCapture(0, 0);

  let offsetX = 0;
  let offsetY = 0;
  let drag: { pointerID: number; x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (event) => {
    if (drag || event.button !== 0) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    drag = { pointerID: event.pointerId, x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointermove', (event) => {
    if (drag?.pointerID !== event.pointerId) {
      return;
    }
    // Store offsets in canvas fractions so resizing scales the composition.
    const bounds = canvas.getBoundingClientRect();
    offsetX += (event.clientX - drag.x) / bounds.width;
    offsetY += (event.clientY - drag.y) / bounds.height;
    drag.x = event.clientX;
    drag.y = event.clientY;
    world.gear.placeForIconCapture(offsetX, offsetY);
  });
  canvas.addEventListener('lostpointercapture', (event) => {
    if (drag?.pointerID === event.pointerId) {
      drag = null;
    }
  });
}

function main() {
  const canvas: HTMLCanvasElement = document.getElementById('background') as HTMLCanvasElement;
  if(!canvas) {
    document.body.innerHTML='<h1>No canvas</h1>';
    return;
  }
  const iconCapture = location.pathname === '/' && new URLSearchParams(location.search).get('icon') === '1';
  world = World.fromCanvas(canvas, iconCapture);
  if(!world) {
    document.body.innerHTML='<h1>WebGL not supported</h1>';
    analytics.exception('webgl_unsupported', true);
    return;
  }
  if (iconCapture) {
    enableIconCapture(world);
    world.start();
    return;
  }
  world.start();
  world.openLandingLayer();
}

document.addEventListener('DOMContentLoaded', main, false);
