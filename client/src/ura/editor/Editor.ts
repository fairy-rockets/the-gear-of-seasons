import Preview from "./Preview";
import * as protocol from 'lib/protocol';

export default class Editor {
  private readonly title_: HTMLInputElement;
  private readonly date_: HTMLInputElement;
  private readonly author_: HTMLSelectElement;
  private readonly text_: HTMLTextAreaElement;
  private readonly submit_: HTMLButtonElement;
  private originalDate_: string;
  private readonly onChangeEventListener_: () => void;
  private preview_: Preview | null;
  private changeId_: NodeJS.Timeout | null;
  executePreviewUpdater_: () => void;
  onSaveEventListener_: () => void;
  constructor(title: HTMLInputElement, date: HTMLInputElement, author: HTMLSelectElement, text: HTMLTextAreaElement, submit: HTMLButtonElement) {
    this.title_ = title;
    this.date_ = date;
    this.author_ = author;
    this.text_ = text;
    this.submit_ = submit;
    this.originalDate_ = date.value;
    this.onChangeEventListener_ = this.onChange_.bind(this);
    this.preview_ = null;
    this.changeId_ = null;
    this.executePreviewUpdater_ = this.executePreviewUpdate_.bind(this);
    this.onSaveEventListener_ = this.onSave_.bind(this);
  }

  init(preview: Preview) {
    this.preview_ = preview;
    this.text_.addEventListener('input', this.onChangeEventListener_);
    this.title_.addEventListener('input', this.onChangeEventListener_);
    this.date_.addEventListener('input', this.onChangeEventListener_);
    this.author_.addEventListener('change', this.onChangeEventListener_);
    this.submit_.addEventListener('click', this.onSaveEventListener_);
    window.addEventListener('keypress', (event) => {
      if (!(event.which === 115 && event.ctrlKey) && !(event.which === 19)) return true;
      window.setTimeout(this.onSaveEventListener_, 0);
      event.preventDefault();
      return false;
    });
    // reload対策
    if(this.text_.value.length > 0 || this.title_.value.length > 0) {
      this.onChange_();
    }
    this.submit_.disabled = true;
  }
  /**
   * @private
   */
  onChange_() {
    this.submit_.disabled = false;
    if(!!this.changeId_) {
      return;
    }
    this.changeId_ = setTimeout(this.executePreviewUpdater_, 500);
  }
  makeMoment_(): protocol.Moment.Save.Request {
    return {
      title: this.title_.value,
      originalDate: this.originalDate_.length > 0 ? this.originalDate_ : null,
      date: this.date_.value.length > 0 ? this.date_.value : null,
      author: this.author_.value,
      text: this.text_.value
    };
  }
  /**
   * @private
   */
  onSave_() {
    this.changeId_ = null;
    const moment = this.makeMoment_();
    fetch('/save', {
      method: 'POST',
      body: JSON.stringify(moment),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }}).then(result => result.json())
      .then((result: protocol.Moment.Save.Response) => {
        this.submit_.disabled = true;
        this.preview_!.onChange(result.body);
        this.date_.value = result.date;
        this.originalDate_ = result.date;
        history.replaceState(null, moment.title, result.path);
      });
  }
  executePreviewUpdate_() {
    this.changeId_ = null;
    const moment = this.makeMoment_();
    fetch('/preview', {
      method: 'POST',
      body: JSON.stringify(moment),
      headers: {
        'Accept': 'text/html',
        'Content-Type': 'application/json'
      }}).then(result => result.text())
      .then(body => this.preview_!.onChange(body));
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
    this.executePreviewUpdate_();
  }
}

