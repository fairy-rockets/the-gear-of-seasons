import Gear from './Gear';
import World from './World';

/** @type {World} */
let world = null;

function main() {
  /** @type {HTMLCanvasElement} */
  const wrapper = document.getElementById('background_wrapper');
  const canvas = document.getElementById('background');
  if(!canvas || !wrapper) {
    document.body.innerHTML='<h1>No canvas</h1>';
    return;
  }
  world = World.fromCanvas(wrapper, canvas);
  if(!world) {
    document.body.innerHTML='<h1>WebGL not supported</h1>';
    return;
  }
  world.start();
}

document.addEventListener('DOMContentLoaded', function() {
  main();
});