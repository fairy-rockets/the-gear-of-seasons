import Editor from "./Editor";
import Preview from "./Preview";

function newEditor() {
  const title = document.getElementById('title');
  const date = document.getElementById('date');
  const author = document.getElementById('author');
  const text = document.getElementById('text');
  const submit = document.getElementById('submig');
  return new Editor(title, date, author, text, submit);
}
function newPreview() {
  return new Preview(document.getElementById('preview'));
}

/** @type {Editor} */
let editor = null;
/** @type {Preview} */
let preview = null;

export default function main() {
  editor = newEditor();
  preview = newPreview();
  editor.init(preview);
  preview.init(editor);
}