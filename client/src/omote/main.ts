import World from './World';
import * as analytics from './Analytics';

let world: World | null = null;

function main() {
  const canvas: HTMLCanvasElement = document.getElementById('background') as HTMLCanvasElement;
  if(!canvas) {
    document.body.innerHTML='<h1>No canvas</h1>';
    return;
  }
  world = World.fromCanvas(canvas);
  if(!world) {
    document.body.innerHTML='<h1>WebGL not supported</h1>';
    analytics.exception('webgl_unsupported', true);
    return;
  }
  world.start();

  world.openLayer(location.pathname, 'landing');
}

document.addEventListener('DOMContentLoaded', main, false);
