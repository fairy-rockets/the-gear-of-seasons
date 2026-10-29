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
  private readonly onChangeEventListener_: () => void;
  private preview_: Preview | null;
  private changeId_: number | null;
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
    this.onChangeEventListener_ = this.onChange_.bind(this);
    this.preview_ = null;
    this.changeId_ = null;
    this.executePreviewUpdater_ = this.executePreviewUpdate_.bind(this);
    this.onSaveEventListener_ = this.onSave_.bind(this);
    this.onDeleteEventListener_ = this.onDelete_.bind(this);
  }

  init(preview: Preview) {
    this.preview_ = preview;
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
        window.setTimeout(this.onSaveEventListener_, 0);
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
    this.save_.disabled = false;
    if(!!this.changeId_) {
      return;
    }
    this.changeId_ = window.setTimeout(this.executePreviewUpdater_, 500);
  }

  private makeMoment_(): protocol.Moment.Save.Request {
    return {
      title: this.title_.value,
      originalDate: this.originalDate_.length > 0 ? this.originalDate_ : null,
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
    this.changeId_ = null;
    const moment = this.makeMoment_();
    let result: protocol.Moment.Save.Response;
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
    }
    this.save_.disabled = true;
    this.delete_.disabled = false;
    dismissToast(PREVIEW_TOAST_KEY);
    this.preview_!.onChange(result.body);
    this.date_.value = result.date;
    this.originalDate_ = result.date;
    this.status_.value = result.status;
    // 手で上書きしている間は、応答の sensitive は上書きの値なので、「自動（今は…）」は前の表示のまま
    if (!result.sensitiveManual) {
      const auto = this.sensitive_.querySelector('option[value="auto"]') as HTMLOptionElement;
      auto.textContent = `自動（今は ${result.sensitive ? 'はい' : 'いいえ'}）`;
    }
    history.replaceState(null, moment.title, result.path);
  }

  private async onDelete_() {
    if (this.date_.value.length === 0) {
      return;
    }
    if (!confirm('本当に削除する？')) {
      return;
    }
    const req: protocol.Moment.Delete.Request = {
      date: this.date_.value,
    };
    let reply: protocol.Moment.Delete.Response;
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
      return;
    }
    window.location.href = `/moments/${reply.year}`;
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
    this.save_.disabled = false;
    this.executePreviewUpdate_();
  }
}

