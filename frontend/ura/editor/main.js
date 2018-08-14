import Editor from './Editor.js';
import Preview from './Preview.js';
import Uploader from './Uploader.js';

function newEditor() {
  const title = document.getElementById('title');
  const date = document.getElementById('date');
  const author = document.getElementById('author');
  const text = document.getElementById('text');
  const submit = document.getElementById('submit');
  return new Editor(title, date, author, text, submit);
}
function newPreview() {
  return new Preview(document.getElementById('preview'));
}

function newUploader() {
  return new Uploader(document.body, document.getElementById('upload_button'));
}

/** @type {Editor} */
let editor = null;
/** @type {Preview} */
let preview = null;
/** @type {Uploader} */
let uploader = null;

export default function main() {
  editor = newEditor();
  preview = newPreview();
  uploader = newUploader();
  editor.init(preview);
  preview.init(editor);
  uploader.init(editor);
}