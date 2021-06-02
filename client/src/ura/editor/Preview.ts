import Editor from "./Editor";

export default class Preview {
  private readonly container_: HTMLDivElement;
  private editor_: Editor | null;
  constructor(container: HTMLDivElement) {
    this.container_ = container;
    /** @type {Editor} */
    this.editor_ = null;
  }
  init(editor: Editor) {
    this.editor_ = editor;
  }
  onChange(body: string) {
    this.container_.innerHTML = body;
  }
}