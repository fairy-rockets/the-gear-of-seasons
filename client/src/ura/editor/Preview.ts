import twemoji from 'twemoji';
import AnnotationDrawer from './AnnotationDrawer';
import Editor from './Editor';
import { EMOJI_URL_BASE } from '../../constant';

export default class Preview {
  private readonly container_: HTMLDivElement;
  private editor_: Editor | null;
  private drawer_: AnnotationDrawer | null;
  constructor(container: HTMLDivElement) {
    this.container_ = container;
    /** @type {Editor} */
    this.editor_ = null;
    this.drawer_ = null;
  }
  init(editor: Editor, drawer: AnnotationDrawer) {
    this.editor_ = editor;
    this.drawer_ = drawer;
  }
  onChange(body: string) {
    // 文字列に対して parse すると属性値の絵文字まで <img> に置換されて壊れるので、DOM に対して parse する。
    this.container_.innerHTML = body;
    twemoji.parse(this.container_, {
      base: EMOJI_URL_BASE,
    });
    this.drawer_!.decorate();
  }
}
