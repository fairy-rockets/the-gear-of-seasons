import Editor from './Editor';
import Preview from './Preview';
import Uploader from './Uploader';

function newEditor(): Editor {
  const title = document.getElementById('title') as HTMLInputElement;
  const date = document.getElementById('date') as HTMLInputElement;
  const author = document.getElementById('author') as HTMLSelectElement;
  const status = document.getElementById('status') as HTMLSelectElement;
  const tier = document.getElementById('tier') as HTMLSelectElement;
  const series = document.getElementById('series') as HTMLInputElement;
  const sensitive = document.getElementById('sensitive') as HTMLSelectElement;
  const text = document.getElementById('text') as HTMLTextAreaElement;
  const save = document.getElementById('save') as HTMLButtonElement;
  const del = document.getElementById('delete') as HTMLButtonElement;
  return new Editor(title, date, author, status, tier, series, sensitive, text, save, del);
}

function newPreview(): Preview {
  return new Preview(document.getElementById('preview') as HTMLDivElement);
}

function newUploader(): Uploader {
  return new Uploader(document.body, document.getElementById('upload') as HTMLInputElement);
}

let editor: Editor | null = null;
let preview: Preview | null = null;
let uploader: Uploader | null = null;

export default function main() {
  editor = newEditor();
  preview = newPreview();
  uploader = newUploader();
  editor.init(preview);
  preview.init(editor);
  uploader.init(editor);
}