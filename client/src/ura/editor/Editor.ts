import Preview from './Preview';
import * as protocol from '../../protocol';

export default class Editor {
  private readonly title_: HTMLInputElement;
  private readonly date_: HTMLInputElement;
  private readonly author_: HTMLSelectElement;
  private readonly status_: HTMLSelectElement;
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
  constructor(title: HTMLInputElement, date: HTMLInputElement, author: HTMLSelectElement, status: HTMLSelectElement, text: HTMLTextAreaElement, save: HTMLButtonElement, del: HTMLButtonElement) {
    this.title_ = title;
    this.date_ = date;
    this.author_ = author;
    this.status_ = status;
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
        throw new Error(`${r.status} ${r.statusText}: ${(await r.text()).slice(0, 500)}`);
      }
      result = await r.json() as protocol.Moment.Save.Response;
    } catch (e) {
      // 失敗したときは画面の状態（日付・ステータス・SAVEボタンなど）を変えない
      console.error(e);
      alert(`保存に失敗しました。\n${e instanceof Error ? e.message : e}`);
      return;
    }
    this.save_.disabled = true;
    this.delete_.disabled = false;
    this.preview_!.onChange(result.body);
    this.date_.value = result.date;
    this.originalDate_ = result.date;
    this.status_.value = result.status;
    history.replaceState(null, moment.title, result.path);
  }

  private onDelete_() {
    if (this.date_.value.length === 0) {
      return;
    }
    if (!confirm('本当に削除する？')) {
      return;
    }
    const req: protocol.Moment.Delete.Request = {
      date: this.date_.value,
    };
    fetch('/delete', {
      method: 'POST',
      body: JSON.stringify(req),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }})
      .then(async(r) => {
        if (r.ok) {
          return await r.json() as protocol.Moment.Delete.Response;
        } else {
          throw new Error(await r.text());
        }
      })
      .then((reply: protocol.Moment.Delete.Response) => {
        window.location.href = `/moments/${reply.year}`;
      });
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
        throw new Error(`${r.status} ${r.statusText}: ${(await r.text()).slice(0, 500)}`);
      }
      body = await r.text();
    } catch (e) {
      // 入力のたびに走るので alert は出さない。直前の正しいプレビューを残す
      console.error(e);
      return;
    }
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

