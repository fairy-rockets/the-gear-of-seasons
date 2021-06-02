import World from './World';

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
    return;
  }
  world.start();

  world.openLayer(location.pathname);
}

document.addEventListener('DOMContentLoaded', main, false);
