// 未保存入力の離脱確認を、実際の editor bundle と Chromium で確かめる。
// API はこのページ内だけで置き換えるので、開発・本番のデータには書き込まない。
// 先に compose.dev.yml の app-dev で client を build する。
// docker run --rm -v "$PWD:/app:ro" gears-shot node /app/tools/preview/editor-unsaved.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import puppeteer from '/shot/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const bundle = await readFile('/app/client/dist/ura/editor.js', 'utf8');
const date = '2026/10/31 12:00:00';
const id = '0123456789abcdef0123456789abcdef';
const media = `<img data-entity="${id}" data-type="image">`;
const html = `<!doctype html><meta charset="utf-8"><div class="editor-wrapper">
<input id="title" value="タイトル"><input id="date" value="${date}">
<select id="author"><option>宵宮ナギ</option><option>甚三紅もみじ</option></select>
<select id="status"><option>draft</option><option>published</option></select>
<select id="tier"><option>archive</option><option>pickup</option></select>
<input id="series" value="a, b">
<select id="sensitive"><option value="auto">自動</option><option>true</option><option>false</option></select>
<textarea id="text">本文</textarea><button id="save">SAVE</button><button id="delete">DEL</button>
<button id="upload">UPLOAD</button></div><div id="preview"></div><a id="leave" href="/other">移動</a>
<script src="/js/editor.js"></script>`;
const empty = { medium: null, alt: null, description: null, tags: null, palette: null,
  characters: null, looksNude: null, looksChild: null, looksNote: null, humanVerified: false,
  role: null, roleGroup: null, roleStar: null, roleNote: null };
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
let pending = null;
let hold = false;
let fail = false;
let saves = 0;
let deletes = 0;
let lastDelete = null;
page.on('pageerror', error => { throw error; });
await page.setRequestInterception(true);
page.on('request', async request => {
  const path = new URL(request.url()).pathname;
  if (path === '/js/editor.js') {
    return request.respond({ contentType: 'application/javascript', body: bundle });
  }
  if (path === '/preview') return request.respond({ body: media });
  if (path === '/annotations') return request.respond({ contentType: 'application/json',
    body: JSON.stringify({ entities: [{ entityID: id, type: 'image', annotation: empty }] }) });
  if (['/save', '/annotation', '/delete'].includes(path)) {
    const req = JSON.parse(request.postData());
    if (path === '/save') saves++;
    if (path === '/delete') { deletes++; lastDelete = req; }
    const body = path === '/save' ? { date: req.date ?? date, status: req.status,
      path: '/edit', sensitive: false, sensitiveManual: false, body: media }
      : path === '/delete' ? { year: '2026' } : {};
    const respond = () => request.respond({ status: fail ? 500 : 200,
      contentType: 'application/json', body: JSON.stringify(body) });
    if (hold) { pending = respond; return; }
    return respond();
  }
  return request.respond({ contentType: 'text/html', body: path === '/edit' ? html : '一覧' });
});
const dirty = () => page.evaluate(() => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
});
const input = (selector, value, event = 'input') => page.$eval(selector, (el, value, event) => {
  el.value = value;
  el.dispatchEvent(new Event(event, { bubbles: true }));
}, value, event);
const wait = predicate => page.waitForFunction(predicate);
const idle = () => wait(() => !document.querySelector('#delete').disabled);
const open = async () => {
  await page.goto('http://editor.test/edit', { waitUntil: 'load' });
  await page.click('#title'); // beforeunload の確認に必要なユーザー操作
  await page.waitForSelector('.annotation-mark');
};
const annotation = () => page.click('.annotation-mark');
const annotationInput = async value => {
  const selector = await page.evaluate(() => {
    const label = [...document.querySelectorAll('.annotation-field')]
      .find(el => el.querySelector('.annotation-label').textContent === 'alt');
    label.querySelector('input').id = 'annotation-alt';
    return '#annotation-alt';
  });
  await input(selector, value);
};
const release = async () => { const respond = pending; pending = null; await respond(); hold = false; };
const waitPending = async () => {
  for (let i = 0; i < 100 && pending === null; i++) await new Promise(r => setTimeout(r, 20));
  assert.ok(pending, 'request is pending');
};
try {
  await open();
  assert.equal(await dirty(), false, 'initial load is clean');
  for (const [selector, changed, original, event] of [
    ['#title', '編集', 'タイトル', 'input'], ['#text', '変更', '本文', 'input'],
    ['#date', '2027/01/01 00:00:00', date, 'input'],
    ['#author', '甚三紅もみじ', '宵宮ナギ', 'change'], ['#status', 'published', 'draft', 'change'],
    ['#tier', 'pickup', 'archive', 'change'], ['#series', 'a,b', 'a, b', 'input'],
    ['#sensitive', 'true', 'auto', 'change'],
  ]) {
    await input(selector, changed, event);
    assert.equal(await dirty(), true, `${selector} protects raw changes`);
    await input(selector, original, event);
    assert.equal(await dirty(), false, `${selector} reverting clears changes`);
  }
  console.log('ok: initial load, every moment field, raw series and reverting');

  await input('#title', '保存');
  let nativeDialogs = 0;
  const dismissUnload = async dialog => {
    assert.equal(dialog.type(), 'beforeunload'); nativeDialogs++; await dialog.dismiss();
  };
  page.on('dialog', dismissUnload);
  await page.reload({ waitUntil: 'load', timeout: 2000 }).catch(() => {});
  await page.click('#leave');
  const closing = new Promise(resolve => page.once('dialog', resolve));
  await page.close({ runBeforeUnload: true });
  await closing;
  assert.equal(nativeDialogs, 3, 'native reload, navigation and tab close dialogs');
  assert.equal(await page.$eval('#title', el => el.value), '保存');
  page.off('dialog', dismissUnload);
  await page.click('#save'); await idle();
  assert.equal(await dirty(), false, 'successful SAVE is clean');
  console.log('ok: native reload/navigation/tab close confirmation and successful SAVE');

  hold = true;
  await page.keyboard.down('Control'); await page.keyboard.press('s'); await page.keyboard.up('Control');
  await waitPending(); assert.equal(await dirty(), true, 'clean SAVE pending is protected');
  await release(); await idle(); assert.equal(await dirty(), false);

  fail = true;
  await input('#title', '失敗'); await page.click('#save'); await idle();
  assert.equal(await dirty(), true, 'failed SAVE stays dirty'); fail = false;
  hold = true; await page.click('#save'); await waitPending();
  assert.equal(await dirty(), true, 'SAVE pending is protected');
  await input('#title', '保存');
  assert.equal(await dirty(), true, 'pending SAVE protects even reverted inputs');
  const count = saves;
  await page.keyboard.down('Control'); await page.keyboard.press('s'); await page.keyboard.up('Control');
  await input('#title', '保存中の編集');
  await input('#date', '2027/01/01 00:00:00'); await input('#status', 'published', 'change');
  await release(); await idle();
  assert.equal(saves, count, 'duplicate SAVE is ignored');
  assert.equal(await page.$eval('#date', el => el.value), '2027/01/01 00:00:00');
  assert.equal(await page.$eval('#status', el => el.value), 'published');
  assert.equal(await dirty(), true, 'edits during SAVE survive');
  await page.click('#save'); await idle(); assert.equal(await dirty(), false);
  console.log('ok: failed/pending SAVE, duplicate SAVE and edits during SAVE');

  await annotation(); await page.waitForSelector('.annotation-form input');
  assert.equal(await dirty(), false, 'opening annotation is clean');
  await annotationInput('注釈'); assert.equal(await dirty(), true);
  await input('#title', 'moment も編集');
  // moment SAVE は、開いている注釈を保存しない。
  await page.$eval('#save', el => el.click()); await idle();
  assert.equal(await dirty(), true, 'moment SAVE keeps unsaved annotation');
  fail = true; await page.click('.annotation-save'); await idle();
  assert.equal(await dirty(), true, 'failed annotation save stays dirty'); fail = false;
  hold = true; await page.click('.annotation-save'); await waitPending();
  assert.equal(await dirty(), true, 'annotation request protects navigation');
  await annotationInput('通信中に変更'); await release(); await idle();
  assert.equal(await dirty(), true, 'annotation edits during save survive');
  await page.click('.annotation-save'); await idle(); assert.equal(await dirty(), false);
  await annotationInput('一時変更'); await annotationInput('通信中に変更');
  assert.equal(await dirty(), false, 'annotation revert is clean');
  await input('#title', 'moment だけ未保存');
  await page.click('.annotation-save'); await idle(); assert.equal(await dirty(), true);
  await page.click('.annotation-close');
  console.log('ok: independent saves, failed/pending annotation save, edits and revert');

  let confirmed = '';
  page.once('dialog', async dialog => { confirmed = dialog.message(); await dialog.dismiss(); });
  await page.click('#delete'); assert.equal(deletes, 0); assert.match(confirmed, /保存していない/);
  await input('#date', '2030/01/01 00:00:00');
  fail = true;
  page.once('dialog', dialog => dialog.accept()); await page.click('#delete'); await idle();
  assert.equal(lastDelete.date, '2027/01/01 00:00:00', 'DELETE uses saved identity');
  assert.equal(await dirty(), true, 'failed DELETE retains dirty inputs'); fail = false;
  hold = true;
  page.once('dialog', dialog => dialog.accept()); await page.click('#delete'); await waitPending();
  assert.equal(await dirty(), true, 'DELETE pending is protected');
  let extraDialogs = 0;
  page.on('dialog', async dialog => { extraDialogs++; await dialog.dismiss(); });
  await release(); await page.waitForFunction(() => location.pathname === '/moments/');
  assert.equal(extraDialogs, 0, 'successful DELETE redirects without another dialog');
  console.log('ok: DELETE cancel/failure/pending, saved identity and intentional redirect');
} finally {
  await browser.close();
}
