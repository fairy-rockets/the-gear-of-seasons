import Editor from "./Editor";

export default class Preview {
  /**
   * 
   * @param {HTMLDivElement} container 
   */
  constructor(container) {
    this.container_ = container;
    /** @type {Editor} */
    this.editor_ = null;
  }
  /**
   * 
   * @param {Editor} editor 
   */
  init(editor) {
    this.editor_ = editor;
  }
  /**
   * 
   * @param {string} body 
   */
  onChange(body) {
    this.container_.innerHTML = body;
  }
}