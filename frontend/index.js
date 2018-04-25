import Gear from './Gear';

function main() {
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById('background');
  const ctx = canvas.getContext('webgl');
  if(ctx) {
    const parent =canvas.parentElement;
    paret.removeChild(canvas);
    const elem = document.createElement('div');
    elem.textContent='WebGL not supported';
    elem.id = 'background';
    parent.appendChild(elem);
    return;
  }
  const gear = new Gear();
}

document.addEventListener('DOMContentLoaded', function() {
  main();
});