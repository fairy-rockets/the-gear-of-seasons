import World from './World';
import Gear from './actors/Gear';
import Index from './layers/Index';

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

  open(location.pathname);
}

/**
 * @param {string} pathName 
 */
function open(pathName) {
  if(pathName == '/') {
    openIndex();
  }else if(pathName.startsWith('/i/')){

  }else{

  }
}

function openIndex(){
  const index = new Index(world);
  world.pushLayer(index);
}

document.addEventListener('DOMContentLoaded', function() {
  main();
}, false);