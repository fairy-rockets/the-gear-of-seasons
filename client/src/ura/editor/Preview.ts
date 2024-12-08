import twemoji from 'twemoji';
import Editor from './Editor';
import { EMOJI_URL_BASE } from '../../constant';

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
    this.container_.innerHTML = twemoji.parse(body, {
      base: EMOJI_URL_BASE,
    });
  }
}
