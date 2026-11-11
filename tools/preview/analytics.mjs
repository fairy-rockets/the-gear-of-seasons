// omote が GA4 へ送るイベント(client/src/omote/Analytics.ts)を、実際の bundle と Chromium で確かめる。
// サーバへのリクエストはこのページ内だけで置き換えるので、DB も開発環境も要らない。
// 測定 ID の無いシェルを使うので、イベントは window.dataLayer に溜まるだけで外には送られない。
// 先に compose.dev.yml の app-dev で client を build する。
// docker run --rm -v "$PWD:/app:ro" gears-shot node /app/tools/preview/analytics.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import puppeteer from '/shot/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const kOrigin = 'http://localhost:8889';
const kSiteTitle = '妖精⊸ロケット :: the gear of seasons';
const bundle = await readFile('/app/client/dist/omote/main.js', 'utf8');
const css = await readFile('/app/_assets/static/omote/main.css', 'utf8');

// index.hbs をそのまま使う。{{#if}} の塊(OGP と gtag.js)は外し、残りの {{値}} を埋める。
// 測定 ID が無いときのシェルになる。
const shell = (await readFile('/app/_assets/templates/omote/index.hbs', 'utf8'))
  .replace(/{{#if \w+}}[\s\S]*?{{\/if}}\n?/g, '')
  .replace(/{{(\w+)}}/g, (_, key) => key === 'siteTitle' || key === 'title' ? kSiteTitle : '');
assert.ok(shell.includes('function gtag()'), 'index.hbs から gtag() の定義が消えている');

const kIcon = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// まえ/つぎ の順に並べた moment。3 番目の本文は HTTP 500 で失敗させる。
const kMoments = ['/2020/01/01/00:00:00/', '/2020/01/02/00:00:00/', '/2020/01/03/00:00:00/'];
const kTitles = ['ひとつめ', 'ふたつめ', 'みっつめ'];

function momentBody(i) {
  const prev = i > 0 ? `<a class="moment-footer-prev" href="${kMoments[i - 1]}">← まえの絵</a>` : '';
  const next = i < kMoments.length - 1 ? `<a class="moment-footer-next" href="${kMoments[i + 1]}">つぎの絵 →</a>` : '';
  return `<div class="moment-info"><h1 class="moment-title title">${kTitles[i]}</h1></div><hr>
<p>本文</p>
<hr><div class="moment-footer"><nav class="moment-footer-nav">${prev}<a class="moment-footer-gear" href="/">歯車にもどる</a>${next}</nav>
<nav class="moment-footer-links"><a href="/pickup/">🏮 えらんだ絵をみる</a><a href="/shop/">お店</a></nav></div>`;
}

const kRandom = kMoments.map((path, i) => ({
  angle: i * 0.3, date: path, title: kTitles[i], path, imageURL: `/entity/${i}/icon`, bodyURL: `/moment${path}`,
}));

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });

const outside = [];
// failMoments: /moments/random を失敗させる。page.held に入れたパスは、応答を release() まで止める。
async function openPage({ failMoments = false, noWebGL = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 844, height: 600 });
  page.on('pageerror', error => { throw error; });
  page.held = new Map();
  if (noWebGL) {
    await page.evaluateOnNewDocument(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        return type === 'webgl2' ? null : original.call(this, type, ...rest);
      };
    });
  }
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== kOrigin) {
      outside.push(url.href);
      return request.abort();
    }
    const path = decodeURIComponent(url.pathname);
    const respond = () => {
      if (path === '/js/main.js') return request.respond({ contentType: 'application/javascript', body: bundle });
      if (path === '/static/main.css') return request.respond({ contentType: 'text/css', body: css });
      if (path === '/moments/random') {
        return failMoments ? request.abort() : request.respond({ contentType: 'application/json', body: JSON.stringify(kRandom) });
      }
      if (path.startsWith('/entity/')) return request.respond({ contentType: 'image/png', body: kIcon });
      if (path === '/static/about-us.html') return request.respond({ body: '<h1 class="title">ふたりについて</h1>' });
      if (path === '/static/shop.html') return request.respond({ body: '<h1>お店</h1>' });
      if (path === '/pickup/body') return request.respond({ body: '<h1>えらんだ絵</h1>' });
      if (path.startsWith('/moment/')) {
        const i = kMoments.indexOf(path.slice('/moment'.length));
        return i === 2 ? request.respond({ status: 500, body: 'Internal Server Error' })
          : request.respond({ contentType: 'text/html', body: momentBody(i) });
      }
      return request.respond({ contentType: 'text/html', body: shell });
    };
    if (page.held.has(path)) {
      page.held.set(path, respond);
      return;
    }
    return respond();
  });
  return page;
}

// dataLayer に積まれた gtag('event', 名前, パラメータ) を、積まれた順に返す。
async function events(page) {
  return page.evaluate(() => (window.dataLayer ?? [])
    .map(args => Array.from(args))
    .filter(args => args[0] === 'event')
    .map(([, name, params]) => ({ name, ...params })));
}

const pageViews = list => list.filter(e => e.name === 'page_view');

// page_view が count 件そろうまで待ち、page_view だけを返す。
async function waitPageViews(page, count) {
  await page.waitForFunction(n => (window.dataLayer ?? []).filter(a => a[0] === 'event' && a[1] === 'page_view').length >= n,
    { timeout: 30000 }, count);
  return pageViews(await events(page));
}

async function waitEvent(page, name) {
  await page.waitForFunction(n => (window.dataLayer ?? []).some(a => a[0] === 'event' && a[1] === n),
    { timeout: 30000 }, name);
  return (await events(page)).filter(e => e.name === name);
}

const settle = ms => new Promise(r => setTimeout(r, ms));

// 1) 歯車を開く: landing の page_view と gear_ready。
const page = await openPage();
await page.goto(`${kOrigin}/?utm_source=test`, { waitUntil: 'domcontentloaded' });
let views = await waitPageViews(page, 1);
assert.deepEqual(views[0], { name: 'page_view', page_location: `${kOrigin}/?utm_source=test`,
  page_title: kSiteTitle, nav_via: 'landing' });
const [ready] = await waitEvent(page, 'gear_ready');
assert.ok(Number.isInteger(ready.load_ms) && ready.load_ms >= 0, JSON.stringify(ready));

// 2) 見出しから About us へ。題が届いてから送り、page_referrer は前のページ。
await page.click('#about-us-link');
views = await waitPageViews(page, 2);
assert.deepEqual(views[1], { name: 'page_view', page_location: `${kOrigin}/about-us/`,
  page_title: 'ふたりについて :: the gear of seasons', page_referrer: `${kOrigin}/?utm_source=test`, nav_via: 'header' });

// 3) × ボタンで閉じる。
await page.click('.close-button');
views = await waitPageViews(page, 3);
assert.deepEqual(views[2], { name: 'page_view', page_location: `${kOrigin}/`, page_title: kSiteTitle,
  page_referrer: `${kOrigin}/about-us/`, nav_via: 'close_button' });

// 4) ブラウザの戻るで About us に戻る。
await page.goBack();
views = await waitPageViews(page, 4);
assert.equal(views[3].page_location, `${kOrigin}/about-us/`);
assert.equal(views[3].nav_via, 'history');

// 5) 歯車(canvas)をクリックして閉じる。
await page.evaluate(() => document.getElementById('background').dispatchEvent(new MouseEvent('mouseup')));
views = await waitPageViews(page, 5);
assert.equal(views[4].page_location, `${kOrigin}/`);
assert.equal(views[4].nav_via, 'backdrop');

// 6) 本文が届く前に閉じたページの page_view は、後から届いても送らない。
page.held.set('/static/shop.html', null);
await page.click('#shop-link');
await settle(500);
await page.click('.close-button');
views = await waitPageViews(page, 6);
assert.equal(views[5].page_location, `${kOrigin}/`);
assert.equal(views[5].nav_via, 'close_button');
await page.held.get('/static/shop.html')();
await settle(500);
assert.equal(pageViews(await events(page)).length, 6);
assert.equal((await events(page)).filter(e => e.name === 'gear_ready').length, 1);
await page.close();

// 7) moment の URL を直接開き、まえ/つぎ・歯車にもどるで移る。
const momentPage = await openPage();
await momentPage.goto(`${kOrigin}${kMoments[1]}`, { waitUntil: 'domcontentloaded' });
views = await waitPageViews(momentPage, 1);
assert.deepEqual(views[0], { name: 'page_view', page_location: `${kOrigin}${kMoments[1]}`,
  page_title: 'ふたつめ :: the gear of seasons', nav_via: 'landing' });

// まえの絵。
await momentPage.click('a.moment-footer-prev');
views = await waitPageViews(momentPage, 2);
assert.deepEqual(views[1], { name: 'page_view', page_location: `${kOrigin}${kMoments[0]}`,
  page_title: 'ひとつめ :: the gear of seasons', page_referrer: `${kOrigin}${kMoments[1]}`, nav_via: 'footer_prev' });
await momentPage.goBack();
views = await waitPageViews(momentPage, 3);
assert.equal(views[2].page_location, `${kOrigin}${kMoments[1]}`);
assert.equal(views[2].nav_via, 'history');

// つぎの絵: 本文の取得に失敗しても page_view は送り、exception も送る。
await momentPage.click('a.moment-footer-next');
views = await waitPageViews(momentPage, 4);
assert.deepEqual(views[3], { name: 'page_view', page_location: `${kOrigin}${kMoments[2]}`, page_title: kSiteTitle,
  page_referrer: `${kOrigin}${kMoments[1]}`, nav_via: 'footer_next' });
assert.deepEqual(await waitEvent(momentPage, 'exception'),
  [{ name: 'exception', description: `page_load_failed: ${kMoments[2]}`, fatal: false }]);

// 戻ってから、歯車にもどる。スタックに歯車が無いので作る。
await momentPage.goBack();
views = await waitPageViews(momentPage, 5);
assert.equal(views[4].nav_via, 'history');
await momentPage.click('.moment-footer-gear');
views = await waitPageViews(momentPage, 6);
assert.deepEqual(views[5], { name: 'page_view', page_location: `${kOrigin}/`, page_title: kSiteTitle,
  page_referrer: `${kOrigin}${kMoments[1]}`, nav_via: 'footer_gear' });

// 8) 戻って、moment の下の「お店」へ。
await momentPage.goBack();
views = await waitPageViews(momentPage, 7);
assert.equal(views[6].page_location, `${kOrigin}${kMoments[1]}`);
await momentPage.click('.moment-footer-links a[href="/shop/"]');
views = await waitPageViews(momentPage, 8);
assert.deepEqual(views[7], { name: 'page_view', page_location: `${kOrigin}/shop/`, page_title: kSiteTitle,
  page_referrer: `${kOrigin}${kMoments[1]}`, nav_via: 'footer_link' });
await settle(500);
assert.equal(pageViews(await events(momentPage)).length, 8);
await momentPage.close();

// 8') 開いた URL の本文が届く前に閉じても、landing の page_view は UTM ごと送る。
const earlyClose = await openPage();
earlyClose.held.set(`/moment${kMoments[0]}`, null);
await earlyClose.goto(`${kOrigin}${kMoments[0]}?utm_source=test`, { waitUntil: 'domcontentloaded' });
await earlyClose.waitForSelector('.close-button');
await earlyClose.click('.close-button');
views = await waitPageViews(earlyClose, 2);
assert.deepEqual(views[0], { name: 'page_view', page_location: `${kOrigin}${kMoments[0]}?utm_source=test`,
  page_title: kSiteTitle, nav_via: 'landing' });
assert.deepEqual(views[1], { name: 'page_view', page_location: `${kOrigin}/`, page_title: kSiteTitle,
  page_referrer: `${kOrigin}${kMoments[0]}?utm_source=test`, nav_via: 'close_button' });
await earlyClose.held.get(`/moment${kMoments[0]}`)();
await settle(500);
assert.equal(pageViews(await events(earlyClose)).length, 2);
await earlyClose.close();

// 9) moment の一覧を取れなければ exception を送る。
const failPage = await openPage({ failMoments: true });
await failPage.goto(`${kOrigin}/`, { waitUntil: 'domcontentloaded' });
assert.deepEqual(await waitEvent(failPage, 'exception'),
  [{ name: 'exception', description: 'moments_load_failed', fatal: false }]);
await failPage.close();

// 9') 歯車が出る前に別のページを開いたら、gear_ready は戻っても送らない。
const notReady = await openPage();
notReady.held.set('/moments/random', null);
await notReady.goto(`${kOrigin}/`, { waitUntil: 'domcontentloaded' });
await waitPageViews(notReady, 1);
await notReady.click('#about-us-link');
await waitPageViews(notReady, 2);
await notReady.held.get('/moments/random')();
await notReady.click('.close-button');
await waitPageViews(notReady, 3);
await settle(3000);
assert.deepEqual((await events(notReady)).filter(e => e.name === 'gear_ready'), []);
await notReady.close();

// 10) WebGL が使えなければ、fatal の exception だけを送る。
const noGL = await openPage({ noWebGL: true });
await noGL.goto(`${kOrigin}/`, { waitUntil: 'domcontentloaded' });
await waitEvent(noGL, 'exception');
await settle(500);
assert.deepEqual(await events(noGL), [{ name: 'exception', description: 'webgl_unsupported', fatal: true }]);
await noGL.close();

// 測定 ID が無いシェルなので、gtag.js は読み込まない(外へのリクエストは twemoji の画像だけ)。
assert.deepEqual(outside.filter(href => !href.startsWith('https://cdnjs.cloudflare.com/ajax/libs/twemoji/')), []);

await browser.close();
console.log('ok');
