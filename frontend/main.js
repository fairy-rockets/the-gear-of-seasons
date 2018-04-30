import Gear from './Gear';
import World from './World';
import Index from './Index';

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
  index.attatch();
}

document.addEventListener('DOMContentLoaded', function() {
  main();
});