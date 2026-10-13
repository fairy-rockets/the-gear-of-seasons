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
    // 文字列に対して parse すると属性値の絵文字まで <img> に置換されて壊れるので、DOM に対して parse する。
    this.container_.innerHTML = body;
    twemoji.parse(this.container_, {
      base: EMOJI_URL_BASE,
    });
  }
}
