import AnnotationDrawer from './AnnotationDrawer';
import Preview from './Preview';
import * as protocol from '../../protocol';
import { describeError, describeResponseError, dismissToast, showToast } from './Toast';

const PREVIEW_TOAST_KEY = 'preview';

export default class Editor {
  private readonly title_: HTMLInputElement;
  private readonly date_: HTMLInputElement;
  private readonly author_: HTMLSelectElement;
  private readonly status_: HTMLSelectElement;
  private readonly tier_: HTMLSelectElement;
  private readonly series_: HTMLInputElement;
  private readonly sensitive_: HTMLSelectElement;
  private readonly text_: HTMLTextAreaElement;
  private readonly save_: HTMLButtonElement;
  private readonly delete_: HTMLButtonElement;
  private originalDate_: string;
  private readonly fields_: (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[];
  private savedValues_: string[];
  private guarding_: boolean;
  private readonly beforeUnload_ = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = '';
  };
  private readonly onChangeEventListener_: () => void;
  private preview_: Preview | null;
  private drawer_: AnnotationDrawer | null;
  private changeId_: number | null;
  // moment の SAVE・削除の通信中か。その間、注釈の引き出しは開かず、保存もしない。
  private busy_: boolean;
  executePreviewUpdater_: () => void;
  onSaveEventListener_: () => void;
  onDeleteEventListener_: () => void;
  constructor(title: HTMLInputElement, date: HTMLInputElement, author: HTMLSelectElement, status: HTMLSelectElement, tier: HTMLSelectElement, series: HTMLInputElement, sensitive: HTMLSelectElement, text: HTMLTextAreaElement, save: HTMLButtonElement, del: HTMLButtonElement) {
    this.title_ = title;
    this.date_ = date;
    this.author_ = author;
    this.status_ = status;
    this.tier_ = tier;
    this.series_ = series;
    this.sensitive_ = sensitive;
    this.text_ = text;
    this.save_ = save;
    this.delete_ = del;
    this.originalDate_ = date.value;
    this.fields_ = [title, date, author, status, tier, series, sensitive, text];
    this.savedValues_ = this.formValues_();
    this.guarding_ = false;
    this.onChangeEventListener_ = this.onChange_.bind(this);
    this.preview_ = null;
    this.drawer_ = null;
    this.changeId_ = null;
    this.busy_ = false;
    this.executePreviewUpdater_ = this.executePreviewUpdate_.bind(this);
    this.onSaveEventListener_ = this.onSave_.bind(this);
    this.onDeleteEventListener_ = this.onDelete_.bind(this);
  }

  init(preview: Preview, drawer: AnnotationDrawer) {
    this.preview_ = preview;
    this.drawer_ = drawer;
    this.text_.addEventListener('input', this.onChangeEventListener_);
    this.title_.addEventListener('input', this.onChangeEventListener_);
    this.date_.addEventListener('input', this.onChangeEventListener_);
    this.author_.addEventListener('change', this.onChangeEventListener_);
    this.status_.addEventListener('change', this.onChangeEventListener_);
    this.tier_.addEventListener('change', this.onChangeEventListener_);
    this.series_.addEventListener('input', this.onChangeEventListener_);
    this.sensitive_.addEventListener('change', this.onChangeEventListener_);
    this.save_.addEventListener('click', this.onSaveEventListener_);
    this.delete_.addEventListener('click', this.onDeleteEventListener_);
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      const macMeta = (event.metaKey && !event.ctrlKey);
      const winMeta = (!event.metaKey && event.ctrlKey);
      if (event.key === 's' && (macMeta || winMeta)) { // Ctrl + S / Cmd + S
        // 注釈の引き出しが開いていれば、注釈を保存する。引き出しは SAVE ボタンのある列を覆うので、
        // いま押せる保存ボタンを押すのと同じにする。
        if (this.drawer_!.isOpen()) {
          window.setTimeout(() => this.drawer_!.save(), 0);
        } else {
          window.setTimeout(this.onSaveEventListener_, 0);
        }
        event.preventDefault();
        return false;
      }
      return true;
    });
    // reload対策
    if(this.text_.value.length > 0 || this.title_.value.length > 0) {
      this.onChange_();
    }
    this.delete_.disabled = location.pathname === '/new';
    this.save_.disabled = true;
  }

  private onChange_() {
    this.updateUnsavedChanges();
    if(!!this.changeId_) {
      return;
    }
    this.changeId_ = window.setTimeout(this.executePreviewUpdater_, 500);
  }

  isBusy(): boolean {
    return this.busy_;
  }

  private setBusy_(busy: boolean) {
    this.busy_ = busy;
    this.drawer_!.onEditorBusyChanged();
    this.updateUnsavedChanges();
  }

  private formValues_(): string[] {
    return this.fields_.map((field) => field.value);
  }

  private hasUnsavedMoment_(): boolean {
    return this.formValues_().some((value, i) => value !== this.savedValues_[i]);
  }

  // moment と注釈は別々に保存する。どちらかの未保存入力か、書き込みの通信がある間だけ守る。
  updateUnsavedChanges() {
    const guard = this.hasUnsavedMoment_() || this.busy_ ||
      (this.drawer_ !== null && (this.drawer_.hasUnsavedChanges() || this.drawer_.isSaving()));
    if (guard !== this.guarding_) {
      if (guard) {
        window.addEventListener('beforeunload', this.beforeUnload_);
      } else {
        window.removeEventListener('beforeunload', this.beforeUnload_);
      }
      this.guarding_ = guard;
    }
    const busy = this.busy_ || (this.drawer_ !== null && this.drawer_.isSaving());
    this.save_.disabled = busy || !this.hasUnsavedMoment_();
    this.delete_.disabled = busy || this.originalDate() === null;
  }

  // 開いている moment の、保存されている日時。新規なら null。
  originalDate(): string | null {
    return this.originalDate_.length > 0 ? this.originalDate_ : null;
  }

  // 保存のあとの sensitive を「自動（今は…）」に出す。
  // 手で上書きしている間は、sensitive は上書きの値なので、「自動（今は…）」は前の表示のまま
  showAutoSensitive(sensitive: boolean, sensitiveManual: boolean) {
    if (sensitiveManual) {
      return;
    }
    const auto = this.sensitive_.querySelector('option[value="auto"]') as HTMLOptionElement;
    auto.textContent = `自動（今は ${sensitive ? 'はい' : 'いいえ'}）`;
  }

  private makeMoment_(): protocol.Moment.Save.Request {
    return {
      title: this.title_.value,
      originalDate: this.originalDate(),
      date: this.date_.value.length > 0 ? this.date_.value : null,
      author: this.author_.value,
      text: this.text_.value,
      status: this.status_.value as protocol.MomentStatus,
      tier: this.tier_.value as protocol.MomentTier,
      // カンマ区切り。前後の空白と、空の要素は落とす。
      series: this.series_.value.split(',').map((s) => s.trim()).filter((s) => s.length > 0),
      sensitiveOverride: this.sensitive_.value === 'auto' ? null : this.sensitive_.value === 'true',
    };
  }

  private async onSave_() {
    if (this.busy_ || this.drawer_!.isSaving()) {
      return;
    }
    const submitted = this.formValues_();
    this.changeId_ = null;
    const moment = this.makeMoment_();
    let result: protocol.Moment.Save.Response;
    this.setBusy_(true);
    try {
      const r = await fetch('/save', {
        method: 'POST',
        body: JSON.stringify(moment),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }});
      if (!r.ok) {
        throw new Error(await describeResponseError(r));
      }
      result = await r.json() as protocol.Moment.Save.Response;
    } catch (e) {
      // 失敗したときは画面の状態（日付・ステータス・SAVEボタンなど）を変えない
      console.error(e);
      showToast(`保存に失敗しました: ${describeError(e)}`);
      return;
    } finally {
      this.setBusy_(false);
    }
    const unchanged = this.formValues_().every((value, i) => value === submitted[i]);
    // 応答の日時・ステータスは、送信後にその欄を編集していなければ反映する。
    if (this.date_.value === submitted[1]) {
      this.date_.value = result.date;
    }
    if (this.status_.value === submitted[3]) {
      this.status_.value = result.status;
    }
    submitted[1] = result.date;
    submitted[3] = result.status;
    this.savedValues_ = submitted;
    this.originalDate_ = result.date;
    this.updateUnsavedChanges();
    if (unchanged) {
      dismissToast(PREVIEW_TOAST_KEY);
      this.preview_!.onChange(result.body);
    } else {
      this.executePreviewUpdate_();
    }
    this.showAutoSensitive(result.sensitive, result.sensitiveManual);
    history.replaceState(null, moment.title, result.path);
  }

  private async onDelete_() {
    if (this.busy_ || this.drawer_!.isSaving() || this.originalDate() === null) {
      return;
    }
    const message = this.hasUnsavedMoment_() || this.drawer_!.hasUnsavedChanges()
      ? '保存していない入力を捨てて、本当に削除する？' : '本当に削除する？';
    if (!confirm(message)) {
      return;
    }
    const req: protocol.Moment.Delete.Request = {
      date: this.originalDate()!,
    };
    let reply: protocol.Moment.Delete.Response;
    this.setBusy_(true);
    try {
      const r = await fetch('/delete', {
        method: 'POST',
        body: JSON.stringify(req),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }});
      if (!r.ok) {
        throw new Error(await describeResponseError(r));
      }
      reply = await r.json() as protocol.Moment.Delete.Response;
    } catch (e) {
      console.error(e);
      showToast(`削除に失敗しました: ${describeError(e)}`);
      this.setBusy_(false);
      return;
    }
    // 成功したら一覧へ移るので、通信中のまま（引き出しを開かせない）にする。
    window.removeEventListener('beforeunload', this.beforeUnload_);
    window.location.href = `/moments/?year=${reply.year}`;
  }

  private async executePreviewUpdate_() {
    this.changeId_ = null;
    const moment = this.makeMoment_();
    let body: string;
    try {
      const r = await fetch('/preview', {
        method: 'POST',
        body: JSON.stringify(moment),
        headers: {
          'Accept': 'text/html',
          'Content-Type': 'application/json'
        }});
      if (!r.ok) {
        throw new Error(await describeResponseError(r));
      }
      body = await r.text();
    } catch (e) {
      // 入力のたびに走るので、トーストは 1 つだけ出したままにして本文を差し替える。直前の正しいプレビューを残す
      console.error(e);
      showToast(`プレビューを更新できません: ${describeError(e)}`, { key: PREVIEW_TOAST_KEY, sticky: true });
      return;
    }
    dismissToast(PREVIEW_TOAST_KEY);
    this.preview_!.onChange(body);
  }

  onUpload(embeds: string[]) {
    const embedsString = embeds.join('\n\n');
    if (this.text_.selectionStart || this.text_.selectionStart === 0) {
      const startPos = this.text_.selectionStart;
      const endPos = this.text_.selectionEnd;
      this.text_.value =
            this.text_.value.substring(0, startPos)
          + embedsString
          + this.text_.value.substring(endPos, this.text_.value.length);
    } else {
      this.text_.value += '\n' + embedsString;
    }
    this.updateUnsavedChanges();
    this.executePreviewUpdate_();
  }
}

