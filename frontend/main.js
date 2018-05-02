import World from './World';
import Gear from './actors/Gear';
import Index from './layers/Index';
import Page from './layers/Page';

/** @type {World} */
let world = null;

function main() {
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById('background');
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


document.addEventListener('DOMContentLoaded', function() {
  main();
}, false);