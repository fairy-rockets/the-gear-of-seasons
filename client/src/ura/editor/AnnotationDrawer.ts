import * as protocol from '../../protocol';
import Editor from './Editor';
import { describeError, describeResponseError, showToast } from './Toast';

type AnnotationField = protocol.AnnotationField;
type AnnotationValues = protocol.AnnotationValues;

// 読んだ注釈。entity ごとに1つで、プレビューを描き直しても残す。
type Entry = {
  type: protocol.EntityType;
  annotation: AnnotationValues;
};

// 入力欄の種類。項目と種類の対応は kKinds。
type Kind =
  { kind: 'enum', values: readonly string[] } |
  { kind: 'string', multiline: boolean } |
  { kind: 'list' } |
  { kind: 'tristate' } |
  { kind: 'checked' };

// Record にしてあるので、protocol.ts に項目を足すと、ここに足すまでコンパイルが通らない。
const kKinds: Record<AnnotationField, Kind> = {
  medium: { kind: 'enum', values: protocol.kAnnotationMedia },
  alt: { kind: 'string', multiline: false },
  description: { kind: 'string', multiline: true },
  tags: { kind: 'list' },
  palette: { kind: 'enum', values: protocol.kAnnotationPalettes },
  characters: { kind: 'list' },
  looksNude: { kind: 'enum', values: protocol.kLooksNude },
  looksChild: { kind: 'enum', values: protocol.kLooksChild },
  looksNote: { kind: 'string', multiline: false },
  checked: { kind: 'checked' },
  role: { kind: 'enum', values: protocol.kAnnotationRoles },
  roleGroup: { kind: 'string', multiline: false },
  roleStar: { kind: 'tristate' },
  roleNote: { kind: 'string', multiline: false },
};

// 欄の見出し。DB とキュレーションのファイルと同じ名前にする。
const kLabels: Record<AnnotationField, string> = {
  medium: 'medium',
  alt: 'alt',
  description: 'description',
  tags: 'tags',
  palette: 'palette',
  characters: 'characters',
  looksNude: 'looks_nude',
  looksChild: 'looks_child',
  looksNote: 'looks_note',
  checked: 'checked（確認済み）',
  role: 'role',
  roleGroup: 'role_group',
  roleStar: 'role_star',
  roleNote: 'role_note',
};

const kTypeLabels: Record<protocol.EntityType, string> = {
  image: '画像',
  video: '動画',
  audio: '音声',
};

// GET /annotations の1度に読む数の上限（サーバーと同じ）。
const kMaxFindIDs = 256;

// entity の id の形（サーバーと同じ、md5）。合わない id には印を付けず、読みにも行かない。
const kEntityID = /^[0-9a-f]{32}$/;

const LOAD_TOAST_KEY = 'annotation-load';

// 1つの項目の入力欄。触っていない項目は、読んだ値のまま送る（import で入った '' などを黙って null にしない）。
type Input = {
  elem: HTMLElement;
  touched: boolean;
  read: () => AnnotationValues[AnnotationField];
};

type Opened = {
  id: string;
  entry: Entry;
  // 読んだ値（保存したあとは保存した値）。触っていない項目はこの値を送る。
  original: AnnotationValues;
  inputs: Map<AnnotationField, Input>;
};

type Mark = { state: 'loading' | 'unentered' | 'unchecked' | 'checked' | 'entered', label: string };

function markOf(entry: Entry | undefined): Mark {
  if (entry === undefined) {
    return { state: 'loading', label: '注釈：…' };
  }
  const fields = protocol.kAnnotationFieldsByType[entry.type];
  const a = entry.annotation;
  const unentered = fields.every((f) => f === 'checked' ? !a.checked : a[f] === null);
  if (unentered) {
    return { state: 'unentered', label: '注釈：未入力' };
  }
  // 音声は checked を持たないので、入力の有無だけを出す。
  if (!fields.includes('checked')) {
    return { state: 'entered', label: '注釈：入力済み' };
  }
  return a.checked
    ? { state: 'checked', label: '注釈：確認済み' }
    : { state: 'unchecked', label: '注釈：未確認' };
}

async function fetchAnnotations(ids: string[]): Promise<protocol.Annotation.Find.Response['entities']> {
  const entities: protocol.Annotation.Find.Response['entities'] = [];
  for (let i = 0; i < ids.length; i += kMaxFindIDs) {
    const chunk = ids.slice(i, i + kMaxFindIDs);
    const r = await fetch(`/annotations?ids=${chunk.map(encodeURIComponent).join(',')}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!r.ok) {
      throw new Error(await describeResponseError(r));
    }
    const result = await r.json() as protocol.Annotation.Find.Response;
    entities.push(...result.entities);
  }
  return entities;
}

function splitList(text: string): string[] {
  return text.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

// プレビューのメディアから開く、注釈の引き出し。本文の入力欄（左の列）の上にかぶせて出す。
export default class AnnotationDrawer {
  private readonly column_: HTMLElement;
  private readonly preview_: HTMLElement;
  private readonly drawer_: HTMLDivElement;
  private readonly icon_: HTMLImageElement;
  private readonly title_: HTMLDivElement;
  private readonly form_: HTMLDivElement;
  private readonly status_: HTMLSpanElement;
  private readonly save_: HTMLButtonElement;
  private readonly close_: HTMLButtonElement;
  private editor_: Editor | null;
  private readonly annotations_: Map<string, Entry>;
  private readonly loading_: Set<string>;
  private opened_: Opened | null;
  // 開こうとして、注釈を読み直している entity。読み直しの間に別のメディアを選んだら、後の方だけを開く。
  private opening_: string | null;
  private saving_: boolean;

  constructor(column: HTMLElement, preview: HTMLElement) {
    this.column_ = column;
    this.preview_ = preview;
    this.editor_ = null;
    this.annotations_ = new Map();
    this.loading_ = new Set();
    this.opened_ = null;
    this.opening_ = null;
    this.saving_ = false;

    this.drawer_ = document.createElement('div');
    this.drawer_.classList.add('annotation-drawer');
    this.drawer_.hidden = true;

    const header = document.createElement('div');
    header.classList.add('annotation-header');
    this.icon_ = document.createElement('img');
    this.icon_.classList.add('annotation-icon');
    this.icon_.alt = '';
    header.appendChild(this.icon_);
    this.title_ = document.createElement('div');
    this.title_.classList.add('annotation-title');
    header.appendChild(this.title_);
    this.close_ = document.createElement('button');
    this.close_.type = 'button';
    this.close_.classList.add('annotation-close');
    this.close_.title = '閉じる';
    this.close_.textContent = '×';
    this.close_.addEventListener('click', () => this.close());
    header.appendChild(this.close_);
    this.drawer_.appendChild(header);

    this.form_ = document.createElement('div');
    this.form_.classList.add('annotation-form');
    this.form_.addEventListener('input', () => this.updateStatus_());
    this.form_.addEventListener('change', () => this.updateStatus_());
    this.drawer_.appendChild(this.form_);

    const footer = document.createElement('div');
    footer.classList.add('annotation-footer');
    this.status_ = document.createElement('span');
    this.status_.classList.add('annotation-status');
    footer.appendChild(this.status_);
    this.save_ = document.createElement('button');
    this.save_.type = 'button';
    this.save_.classList.add('annotation-save');
    this.save_.textContent = '注釈を保存';
    this.save_.addEventListener('click', () => this.save());
    footer.appendChild(this.save_);
    this.drawer_.appendChild(footer);

    column.appendChild(this.drawer_);

    this.preview_.addEventListener('click', this.onPreviewClick_.bind(this));
  }

  init(editor: Editor) {
    this.editor_ = editor;
  }

  isOpen(): boolean {
    return this.opened_ !== null;
  }

  // プレビューを描き直すたびに呼ぶ。各メディアの直前に印を差し込み、まだ読んでいない注釈を読む。
  decorate() {
    const unread = new Set<string>();
    for (const media of Array.from(this.preview_.querySelectorAll<HTMLElement>('[data-entity]'))) {
      const id = media.dataset.entity!;
      if (!kEntityID.test(id)) {
        continue;
      }
      const mark = document.createElement('button');
      mark.type = 'button';
      mark.classList.add('annotation-mark');
      // 印には data-entity を付けない（[data-entity] はメディアだけを指すようにする）。
      mark.dataset.annotation = id;
      // 画像を包むリンクの中には入れない。
      const anchor = media.parentElement !== null && media.parentElement.tagName === 'A' ? media.parentElement : media;
      anchor.parentNode!.insertBefore(mark, anchor);
      if (this.opened_ !== null && this.opened_.id === id) {
        media.classList.add('annotation-selected');
      }
      if (!this.annotations_.has(id) && !this.loading_.has(id)) {
        unread.add(id);
      }
    }
    this.refreshMarks_();
    if (unread.size > 0) {
      this.load_([...unread]);
    }
  }

  // 保存していない入力があれば、確かめてから閉じる。閉じたら true。
  // 保存の通信中は閉じない。
  close(): boolean {
    if (this.opened_ === null) {
      return true;
    }
    if (this.saving_ || !this.confirmDiscard_()) {
      return false;
    }
    this.opened_ = null;
    this.show_(false);
    this.form_.replaceChildren();
    this.select_(null);
    return true;
  }

  // 引き出しは本文の入力欄の列を覆うので、開いている間は覆った要素に inert を付け、Tab でフォーカスが移らないようにする。
  private show_(visible: boolean) {
    this.drawer_.hidden = !visible;
    for (const child of Array.from(this.column_.children)) {
      if (child !== this.drawer_) {
        child.toggleAttribute('inert', visible);
      }
    }
  }

  // 保存の通信中は、閉じる・保存のボタンを押せなくする。
  private setSaving_(saving: boolean) {
    this.saving_ = saving;
    this.save_.disabled = saving;
    this.close_.disabled = saving;
  }

  async save() {
    const opened = this.opened_;
    if (opened === null || this.saving_) {
      return;
    }
    const values = this.values_(opened);
    const req: protocol.Annotation.Save.Request = {
      entityID: opened.id,
      originalDate: this.editor_!.originalDate(),
      annotation: values,
    };
    let result: protocol.Annotation.Save.Response;
    this.setSaving_(true);
    try {
      const r = await fetch('/annotation', {
        method: 'POST',
        body: JSON.stringify(req),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }});
      if (!r.ok) {
        throw new Error(await describeResponseError(r));
      }
      result = await r.json() as protocol.Annotation.Save.Response;
    } catch (e) {
      // 失敗したときは入力を残す
      console.error(e);
      showToast(`注釈を保存できませんでした: ${describeError(e)}`);
      return;
    } finally {
      this.setSaving_(false);
    }
    opened.entry.annotation = values;
    opened.original = values;
    this.refreshMarks_();
    this.updateStatus_('保存しました');
    if (result.moment !== undefined) {
      this.editor_!.showAutoSensitive(result.moment.sensitive, result.moment.sensitiveManual);
    }
  }

  private onPreviewClick_(event: MouseEvent) {
    const target = event.target as Element;
    const mark = target.closest<HTMLElement>('.annotation-mark');
    if (mark !== null) {
      event.preventDefault();
      this.open_(mark.dataset.annotation!);
      return;
    }
    // 動画と音声はクリックが再生の操作とぶつかるので、印からだけ開く。
    const image = target.closest<HTMLElement>('img[data-entity]');
    if (image !== null) {
      event.preventDefault();
      if (kEntityID.test(image.dataset.entity!)) {
        this.open_(image.dataset.entity!);
      }
      return;
    }
    // プレビューの中では、画像を包むリンクでページを移らない。
    const link = target.closest('a');
    if (link !== null && link.querySelector('[data-entity]') !== null) {
      event.preventDefault();
    }
  }

  // 開くたびに、その entity の注釈を読み直して欄を組む。ほかのタブや import で変わった値を、
  // 前に読んだ値のまま保存して黙って戻さないため。読み直せなければ開かない。
  private async open_(id: string) {
    // 保存の通信中は、別のメディアを開かない。
    if (this.saving_) {
      return;
    }
    if (this.opened_ !== null && this.opened_.id === id) {
      this.select_(id);
      return;
    }
    if (!this.close()) {
      return;
    }
    this.opening_ = id;
    let found: protocol.Annotation.Find.Response['entities'];
    try {
      found = await fetchAnnotations([id]);
    } catch (e) {
      console.error(e);
      if (this.opening_ === id) {
        this.opening_ = null;
        showToast(`注釈を読めないので、引き出しを開けません: ${describeError(e)}`);
      }
      return;
    }
    // 読み直している間に、別のメディアを選んだ・もう開いた。
    if (this.opening_ !== id || this.opened_ !== null) {
      return;
    }
    this.opening_ = null;
    const e = found.find((it) => it.entityID === id);
    if (e === undefined) {
      showToast(`entity が見つからないので、引き出しを開けません: ${id}`);
      return;
    }
    const entry: Entry = { type: e.type, annotation: e.annotation };
    this.annotations_.set(id, entry);
    this.refreshMarks_();
    const inputs = new Map<AnnotationField, Input>();
    for (const field of protocol.kAnnotationFieldsByType[entry.type]) {
      const input = makeInput(field, entry.annotation[field]);
      inputs.set(field, input);
      this.form_.appendChild(input.elem);
    }
    this.opened_ = { id, entry, original: entry.annotation, inputs };
    this.icon_.src = `/entity/${encodeURIComponent(id)}/icon`;
    this.title_.textContent = `${kTypeLabels[entry.type]}  ${id}`;
    this.show_(true);
    this.drawer_.scrollTop = 0;
    this.updateStatus_();
    this.select_(id);
  }

  // プレビューの中で、選んだメディアを枠で目立たせ、見える位置までスクロールする。
  private select_(id: string | null) {
    for (const media of Array.from(this.preview_.querySelectorAll<HTMLElement>('.annotation-selected'))) {
      media.classList.remove('annotation-selected');
    }
    if (id === null) {
      return;
    }
    let first: HTMLElement | null = null;
    for (const media of Array.from(this.preview_.querySelectorAll<HTMLElement>('[data-entity]'))) {
      if (media.dataset.entity === id) {
        media.classList.add('annotation-selected');
        first = first ?? media;
      }
    }
    first?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  private values_(opened: Opened): AnnotationValues {
    const values = { ...opened.original } as Record<AnnotationField, AnnotationValues[AnnotationField]>;
    for (const [field, input] of opened.inputs) {
      if (input.touched) {
        values[field] = input.read();
      }
    }
    return values as AnnotationValues;
  }

  private isDirty_(): boolean {
    if (this.opened_ === null) {
      return false;
    }
    return JSON.stringify(this.values_(this.opened_)) !== JSON.stringify(this.opened_.original);
  }

  private confirmDiscard_(): boolean {
    if (!this.isDirty_()) {
      return true;
    }
    return confirm('保存していない注釈の入力があります。捨てますか？');
  }

  private updateStatus_(message?: string) {
    if (this.isDirty_()) {
      this.status_.textContent = '保存していない入力があります';
      this.status_.classList.add('annotation-status-dirty');
    } else {
      this.status_.textContent = message ?? '';
      this.status_.classList.remove('annotation-status-dirty');
    }
  }

  private refreshMarks_() {
    for (const mark of Array.from(this.preview_.querySelectorAll<HTMLElement>('.annotation-mark'))) {
      const m = markOf(this.annotations_.get(mark.dataset.annotation!));
      mark.textContent = m.label;
      mark.dataset.state = m.state;
    }
  }

  private async load_(ids: string[]) {
    for (const id of ids) {
      this.loading_.add(id);
    }
    try {
      for (const e of await fetchAnnotations(ids)) {
        // 開いている entity の値は、開いたときに読み直したものを保つ（保存で印と揃える）。
        if (this.opened_ !== null && this.opened_.id === e.entityID) {
          continue;
        }
        this.annotations_.set(e.entityID, { type: e.type, annotation: e.annotation });
      }
    } catch (e) {
      // 読めなかった id は Map に入らないので、次にプレビューを描き直したときに読み直す
      console.error(e);
      showToast(`注釈を読めませんでした: ${describeError(e)}`, { key: LOAD_TOAST_KEY });
    } finally {
      for (const id of ids) {
        this.loading_.delete(id);
      }
    }
    this.refreshMarks_();
  }
}

// 項目の入力欄を、項目の種類（kKinds）から組み立てる。
function makeInput(field: AnnotationField, value: AnnotationValues[AnnotationField]): Input {
  const kind = kKinds[field];
  // リストの欄は「なし」のチェックを別の label で持つので、行を label にしない（label は入れ子にできない）。
  const row = document.createElement(kind.kind === 'list' ? 'div' : 'label');
  row.classList.add('annotation-field');
  const name = document.createElement('span');
  name.classList.add('annotation-label');
  name.textContent = kLabels[field];
  row.appendChild(name);
  const input: Input = { elem: row, touched: false, read: () => value };
  const touch = () => { input.touched = true; };
  switch (kind.kind) {
    case 'enum': {
      // 「（未入力）」は null。
      const select = document.createElement('select');
      select.appendChild(new Option('（未入力）', ''));
      for (const v of kind.values) {
        select.appendChild(new Option(v, v));
      }
      select.value = (value as string | null) ?? '';
      select.addEventListener('change', touch);
      input.read = () => select.value === '' ? null : select.value as AnnotationValues[AnnotationField];
      row.appendChild(select);
      break;
    }
    case 'string': {
      // 空欄は null（未入力）。読んだ値が '' なら、触らない限り '' のまま送る。
      const text = kind.multiline ? document.createElement('textarea') : document.createElement('input');
      if (text instanceof HTMLInputElement) {
        text.type = 'text';
      } else {
        text.rows = 4;
      }
      text.value = (value as string | null) ?? '';
      text.placeholder = value === '' ? '（空の文字列）' : '（未入力）';
      text.addEventListener('input', () => {
        touch();
        text.placeholder = '（未入力）';
      });
      input.read = () => text.value.length === 0 ? null : text.value;
      row.appendChild(text);
      break;
    }
    case 'list': {
      // カンマ区切り。「なし（空のリスト）」なら []、欄が空でチェックも無ければ null（未入力）。
      const list = value as string[] | null;
      const box = document.createElement('div');
      box.classList.add('annotation-list');
      const text = document.createElement('input');
      text.type = 'text';
      text.placeholder = '（未入力）カンマ区切り';
      text.value = list === null ? '' : list.join(', ');
      const empty = document.createElement('label');
      empty.classList.add('annotation-empty');
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = list !== null && list.length === 0;
      text.disabled = check.checked;
      empty.appendChild(check);
      empty.appendChild(document.createTextNode('なし（空のリスト）'));
      text.addEventListener('input', touch);
      check.addEventListener('change', () => {
        touch();
        text.disabled = check.checked;
      });
      input.read = () => {
        if (check.checked) {
          return [];
        }
        const items = splitList(text.value);
        return items.length === 0 ? null : items;
      };
      box.appendChild(text);
      box.appendChild(empty);
      row.appendChild(box);
      break;
    }
    case 'tristate': {
      const select = document.createElement('select');
      select.appendChild(new Option('（未入力）', ''));
      select.appendChild(new Option('はい', 'true'));
      select.appendChild(new Option('いいえ', 'false'));
      select.value = value === null ? '' : String(value);
      select.addEventListener('change', touch);
      input.read = () => select.value === '' ? null : select.value === 'true';
      row.appendChild(select);
      break;
    }
    case 'checked': {
      row.classList.add('annotation-checked');
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = value === true;
      check.addEventListener('change', touch);
      input.read = () => check.checked;
      // チェックボックスを見出しの前に置く。
      row.insertBefore(check, name);
      break;
    }
  }
  return input;
}
