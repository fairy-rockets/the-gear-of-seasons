import Preview from "./Preview";
import { throws } from "assert";

/**
  @typedef Moment
  @type {object}
  @property {string} title
  @property {string} date
  @property {string} author
  @property {string} text
*/

export default class Editor {
  /**
   * 
   * @param {HTMLInputElement} title 
   * @param {HTMLInputElement} date 
   * @param {HTMLSelectElement} author 
   * @param {HTMLTextAreaElement} text 
   * @param {HTMLButtonElement} submit
   */
  constructor(title, date, author, text, submit) {
    this.title_ = title;
    this.date_ = date;
    this.author_ = author;
    this.text_ = text;
    this.submit_ = submit;
    this.onChangeEventListener_ = this.onChange_.bind(this);
    /** @type {Preview} */
    this.preview_ = null;
    /** @type {number|null} */
    this.changeId_ = null;
    this.executePreviewUpdater_ = this.executePreviewUpdate_.bind(this);
    this.onSaveEventListener_ = this.onSave_.bind(this);
  }
  /**
   * 
   * @param {Preview} preview 
   */
  init(preview) {
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
  /**
   * @private
   * @returns {Moment}
   */
  makeMoment_() {
    /** @type {Moment} */
    const moment = {
      title: this.title_.value,
      date: parseDate(this.date_.value) || new Date(),
      author: this.author_.value,
      text: this.text_.value
    };
    return moment;
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
      .then(result => {
        this.submit_.disabled = true;
        this.preview_.onChange(result.body);
        history.replaceState(null, null, result.path)
      });
  }
  executePreviewUpdate_() {
    this.changeId_ = null;
    const moment = this.makeMoment_();
    fetch('/preview', {
      method: 'POST',
      body: JSON.stringify(moment),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }}).then(result => result.text())
      .then(body => this.preview_.onChange(body));
  }
  /**
   * 
   * @param {string[]} embeds 
   */
  onUpload(embeds) {
    this.text_.value += '\n' + embeds.join('\n\n');
    this.executePreviewUpdate_();
  }
}


const dateParser = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
function parseDate(str) {
  const r = dateParser.exec(str);
  if(!r || r.length < 7) {
    return null;
  }
  const year = parseInt(r[1]);
  const month = parseInt(r[2]);
  const day = parseInt(r[3]);

  const hour = parseInt(r[4]);
  const minute = parseInt(r[5]);
  const second = parseInt(r[6]);

  const d = new Date(year, month - 1, day, hour, minute, second, 0);

  return isNaN(d.getTime()) ? null : d;
}
