import World from './World.js'
export default class Index {
  /**
   * @param {World} world 
   */
  constructor(world) {
    this.world_ = world;
    this.wheelEventListener_ = this.onWheelEvent_.bind(this);
  }
  /**
   * 
   * @param {WheelEvent} event 
   */
  onWheelEvent_(event) {
    event.preventDefault();
    const world = this.world_;
    world.gear.angle += event.deltaY * Math.PI / (360*10);
  }
  attatch() {
    this.world_.canvas.addEventListener('wheel', this.wheelEventListener_);
  }
  dettach() {
    this.world_.canvas.removeEventListener('wheel', this.wheelEventListener_);
  }
}