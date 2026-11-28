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

// index.hbs をそのまま使う。{{#if}} の塊(OGP と gtag.js)は内側から順に外し、残りの {{値}} を埋める。
// 測定 ID が無いときのシェルになる。
let template = await readFile('/app/_assets/templates/omote/index.hbs', 'utf8');
for (let prev = ''; prev !== template;) {
  prev = template;
  template = template.replace(/{{#if \w+}}(?:(?!{{#if)[\s\S])*?{{\/if}}\n?/g, '');
}
assert.ok(!template.includes('{{#') && !template.includes('{{/') && !template.includes('{{else}}'), template);
assert.ok(template.includes('function gtag()'), 'index.hbs から gtag() の定義が消えている');

const kIcon = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// まえ/つぎ の順に並べた moment。3 番目の本文は HTTP 500 で失敗させる。
const kMoments = ['/2020/01/01/00:00:00/', '/2020/01/02/00:00:00/', '/2020/01/03/00:00:00/'];
// 絵文字は本文では twemoji の <img> になるが、題には SSR と同じく文字のまま入る。
const kTitles = ['ひとつめ🐸', 'ふたつめ', 'みっつめ'];

function momentBody(i) {
  const prev = i > 0 ? `<a class="moment-footer-prev" href="${kMoments[i - 1]}">← まえの絵</a>` : '';
  const next = i < kMoments.length - 1 ? `<a class="moment-footer-next" href="${kMoments[i + 1]}">つぎの絵 →</a>` : '';
  return `<div class="moment-info"><h1 class="moment-title title">${kTitles[i]}</h1></div><hr>
<p>本文</p>
<hr><div class="moment-footer"><nav class="moment-footer-nav">${prev}<a class="moment-footer-gear" href="/">歯車にもどる</a>${next}</nav>
<nav class="moment-footer-links"><a href="/pickup/">🏮 えらんだ絵をみる</a><a href="/shop/">お店</a></nav></div>`;
}

// サーバと同じく、シェルの <title> にそのページの題を入れる(server/src/lib/meta.ts の pageTitle)。
const pageTitle = title => `${title} :: the gear of seasons`;
function shellFor(path) {
  const i = kMoments.indexOf(path);
  const title = i >= 0 ? pageTitle(kTitles[i])
    : path === '/about-us/' ? pageTitle('「妖精⊸ロケット」について')
    : path === '/shop/' ? pageTitle('お店')
    : path === '/pickup/' ? pageTitle('えらんだ絵')
    : kSiteTitle;
  return template.replace(/{{(\w+)}}/g, (_, key) => key === 'siteTitle' ? kSiteTitle : key === 'title' ? title : '');
}

// about-us・お店・えらんだ絵の本文は、実物のファイルを使う(題は本文の .title から取る)。
const kAboutUs = await readFile('/app/_assets/static/omote/about-us.html', 'utf8');
const kShop = await readFile('/app/_assets/static/omote/shop.html', 'utf8');
const kPickup = (await readFile('/app/_assets/templates/omote/pickup.hbs', 'utf8'))
  .replace(/{{#each moments}}[\s\S]*?{{\/each}}/, '');

// 長い本文の moment。画像が読み込まれるまでは、画面に収まるほど短い(画像の高さは本文の欄の高さまで)。
const kLongMoment = '/2020/02/01/00:00:00/';
const kLongBody = `<div class="moment-info"><h1 class="moment-title title">ながい</h1></div><hr>
${'<img class="embed" src="/entity/tall/medium" width="800" height="4000" alt="">'.repeat(6)}
<p>本文</p>`;
const kTallImage = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="4000"><rect width="800" height="4000" fill="#888"/></svg>';

// メディアの moment。音声(同じ entity を 2 つ)と loop の動画(1.2 秒の無音の WAV)、倍速で回す loop の動画
// (4 秒の無音の WAV)を置く。
const kMediaMoment = '/2020/03/01/00:00:00/';
const kMediaBody = `<div class="moment-info"><h1 class="moment-title title">おと</h1></div><hr>
<audio class="embed" src="/entity/aud" controls="controls" data-entity="aud" data-type="audio"></audio>
<video class="embed" preload="metadata" loop controls="controls" src="/entity/vid" data-entity="vid" data-type="video"></video>
<audio class="embed" src="/entity/aud" controls="controls" data-entity="aud" data-type="audio"></audio>
<video class="embed" preload="metadata" loop controls="controls" src="/entity/fast" data-entity="fast" data-type="video"></video>
<hr><div class="moment-footer"><nav class="moment-footer-nav"><a class="moment-footer-gear" href="/">歯車にもどる</a></nav></div>`;
function silentWAV(seconds) {
  const rate = 8000;
  const samples = Math.round(rate * seconds);
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples * 2, 40);
  return buf;
}
const kMediaFiles = new Map([['/entity/aud', silentWAV(1.2)], ['/entity/vid', silentWAV(1.2)], ['/entity/fast', silentWAV(4)]]);
// Range に応える(応えないと、Chromium は位置を動かせず、currentTime が 0 に戻る)。
function respondMedia(request, body) {
  const m = /^bytes=(\d+)-(\d*)$/.exec(request.headers().range ?? '');
  if (m === null) {
    return request.respond({ contentType: 'audio/wav', headers: { 'Accept-Ranges': 'bytes' }, body });
  }
  const start = Number(m[1]);
  const end = m[2] === '' ? body.length - 1 : Math.min(Number(m[2]), body.length - 1);
  return request.respond({ status: 206, contentType: 'audio/wav', body: body.subarray(start, end + 1),
    headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${body.length}` } });
}

const kRandom = kMoments.map((path, i) => ({
  angle: i * 0.3, date: path, title: kTitles[i], path, imageURL: `/entity/${i}/icon`, bodyURL: `/moment${path}`,
}));

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });

const outside = [];
// failMoments: /moments/random を失敗させる。page.held に入れたパスは、応答を release() まで止める。
// random: /moments/random の代わりに返す moment。touch: タッチの入力も受けられるようにする。
async function openPage({ failMoments = false, noWebGL = false, random = kRandom, touch = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 844, height: 600, hasTouch: touch });
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
    // data: は外へのリクエストではない(<audio>・<video> の操作ボタンの絵を Chromium がこれで読む)。
    if (url.protocol === 'data:') {
      return request.continue();
    }
    if (url.origin !== kOrigin) {
      outside.push(url.href);
      return request.abort();
    }
    const path = decodeURIComponent(url.pathname);
    const respond = () => {
      if (path === '/js/main.js') return request.respond({ contentType: 'application/javascript', body: bundle });
      if (path === '/static/main.css') return request.respond({ contentType: 'text/css', body: css });
      if (path === '/moments/random') {
        return failMoments ? request.abort() : request.respond({ contentType: 'application/json', body: JSON.stringify(random) });
      }
      if (path === '/entity/tall/medium') return request.respond({ contentType: 'image/svg+xml', body: kTallImage });
      if (path === `/moment${kLongMoment}`) return request.respond({ contentType: 'text/html', body: kLongBody });
      if (path === `/moment${kMediaMoment}`) return request.respond({ contentType: 'text/html', body: kMediaBody });
      if (kMediaFiles.has(path)) return respondMedia(request, kMediaFiles.get(path));
      if (path.startsWith('/entity/')) return request.respond({ contentType: 'image/png', body: kIcon });
      if (path === '/static/about-us.html') return request.respond({ body: kAboutUs });
      if (path === '/static/shop.html') return request.respond({ body: kShop });
      if (path === '/pickup/body') return request.respond({ body: kPickup });
      if (path.startsWith('/moment/')) {
        const i = kMoments.indexOf(path.slice('/moment'.length));
        return i === 2 ? request.respond({ status: 500, body: 'Internal Server Error' })
          : request.respond({ contentType: 'text/html', body: momentBody(i) });
      }
      return request.respond({ contentType: 'text/html', body: shellFor(path) });
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

// dataLayer に積まれた gtag(命令, …) のうち、命令が name のものの引数を返す。
async function commands(page, name) {
  return page.evaluate(n => (window.dataLayer ?? []).map(args => Array.from(args)).filter(args => args[0] === n), name);
}

// events と同じだが、それぞれに、そのとき gtag('set') で付いていた page_location のパスを at に入れる。
async function eventsAt(page) {
  return page.evaluate(() => {
    let at = null;
    const list = [];
    for (const args of (window.dataLayer ?? []).map(a => Array.from(a))) {
      if (args[0] === 'set' && 'page_location' in args[1]) {
        at = new URL(args[1].page_location).pathname;
      } else if (args[0] === 'event') {
        list.push({ name: args[1], ...args[2], at });
      }
    }
    return list;
  });
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
// 運営者の印の Cookie が無ければ、traffic_type は set しない。page_view の後は、そのページを set する
// (次の page_view までのイベントがそのページに付く)。UTM などのクエリは外す。
assert.deepEqual(await commands(page, 'set'), [['set', { page_location: `${kOrigin}/`, page_title: kSiteTitle }]]);
assert.ok(Number.isInteger(ready.load_ms) && ready.load_ms >= 0, JSON.stringify(ready));

// 2) 見出しから About us へ。題が届いてから送り、page_referrer は前のページ。
await page.click('#about-us-link');
views = await waitPageViews(page, 2);
assert.deepEqual(views[1], { name: 'page_view', page_location: `${kOrigin}/about-us/`,
  page_title: pageTitle('「妖精⊸ロケット」について'), page_referrer: `${kOrigin}/?utm_source=test`, nav_via: 'header' });

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
  page_title: pageTitle(kTitles[0]), page_referrer: `${kOrigin}${kMoments[1]}`, nav_via: 'footer_prev' });
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
assert.deepEqual(views[7], { name: 'page_view', page_location: `${kOrigin}/shop/`, page_title: pageTitle('お店'),
  page_referrer: `${kOrigin}${kMoments[1]}`, nav_via: 'footer_link' });
await settle(500);
assert.equal(pageViews(await events(momentPage)).length, 8);
await momentPage.close();

// 8') 開いた URL の page_view は、本文を待たずに SSR の題と UTM ごと送る(すぐにタブを閉じられても残る)。
const earlyClose = await openPage();
earlyClose.held.set(`/moment${kMoments[0]}`, null);
await earlyClose.goto(`${kOrigin}${kMoments[0]}?utm_source=test`, { waitUntil: 'domcontentloaded' });
views = await waitPageViews(earlyClose, 1);
assert.deepEqual(views[0], { name: 'page_view', page_location: `${kOrigin}${kMoments[0]}?utm_source=test`,
  page_title: pageTitle(kTitles[0]), nav_via: 'landing' });
await earlyClose.waitForSelector('.close-button');
await earlyClose.click('.close-button');
views = await waitPageViews(earlyClose, 2);
assert.deepEqual(views[1], { name: 'page_view', page_location: `${kOrigin}/`, page_title: kSiteTitle,
  page_referrer: `${kOrigin}${kMoments[0]}?utm_source=test`, nav_via: 'close_button' });
await earlyClose.held.get(`/moment${kMoments[0]}`)();
await settle(500);
assert.equal(pageViews(await events(earlyClose)).length, 2);
// view_item も、本文が届く前に離れたら送らない。
assert.deepEqual((await events(earlyClose)).filter(e => e.name === 'view_item'), []);
await earlyClose.close();

// 8'') 開いたパスに戻るで戻ると、レイヤを作り直して本文から題を取る(直前のページの題を引き継がない)。
const returnToLanding = await openPage();
await returnToLanding.goto(`${kOrigin}/shop/`, { waitUntil: 'domcontentloaded' });
views = await waitPageViews(returnToLanding, 1);
assert.deepEqual(views[0], { name: 'page_view', page_location: `${kOrigin}/shop/`, page_title: pageTitle('お店'),
  nav_via: 'landing' });
await returnToLanding.waitForSelector('.close-button');
await returnToLanding.click('.close-button');
await waitPageViews(returnToLanding, 2);
await returnToLanding.click('#about-us-link');
await waitPageViews(returnToLanding, 3);
await returnToLanding.goBack();
await waitPageViews(returnToLanding, 4);
await returnToLanding.goBack();
views = await waitPageViews(returnToLanding, 5);
assert.deepEqual(views[4], { name: 'page_view', page_location: `${kOrigin}/shop/`, page_title: pageTitle('お店'),
  page_referrer: `${kOrigin}/`, nav_via: 'history' });
assert.equal(await returnToLanding.title(), pageTitle('お店'));
await returnToLanding.close();

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

// 12) 歯車: 見せた moment(view_item_list)、開いた moment(select_item)、過ごし方(gear_leave)、
// マウスを乗せたのに開かなかった moment(moment_hover)。
// 歯車は今日の向きを決まった位置に置くので、今日からの角度で置けば、日付によらず同じところに出る。
function todayAngle() {
  const now = new Date();
  const beg = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), 11, 31, 12, 59, 59, 999);
  return Math.PI * 2 * ((now.getTime() - beg.getTime()) / (end.getTime() - beg.getTime()));
}
// 今日から 30 度ずつ 12 個。横長の画面では k0・k1・k2・k11 が見え、k6(反対側)は見えない。
const kDial = Array.from({ length: 12 }, (_, k) => ({
  angle: todayAngle() + k * Math.PI / 6, date: `k${k}`, title: `k${k}`, path: `/2020/02/${String(k + 1).padStart(2, '0')}/00:00:00/`,
  imageURL: `/entity/${k}/icon`, bodyURL: `/moment${kMoments[0]}`,
}));
const dialPath = title => kDial.find(m => m.title === title).path;
// k0・k1・k2・k11 の円が出る位置(844x600)。回した後は、ここになければ格子で探す。
const kDiscSpots = [[459, 60], [409, 247], [273, 384], [86, 434]];
const kEmptySpot = [800, 560];

async function setHidden(page, hidden) {
  await page.evaluate(h => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

// マウスを (x, y) に置き、ツールチップが出たらその題を返す。出なければ null。
async function hoverAt(page, x, y) {
  await page.mouse.move(x, y);
  try {
    await page.waitForSelector('.tooltip:not(.hidden)', { timeout: 300 });
  } catch {
    return null;
  }
  return page.$eval('.tooltip .moment-title', el => el.textContent);
}

async function findDisc(page) {
  const grid = [];
  for (let y = 30; y < 600; y += 60) for (let x = 30; x < 844; x += 60) grid.push([x, y]);
  for (const [x, y] of [...kDiscSpots, ...grid]) {
    const title = await hoverAt(page, x, y);
    if (title !== null) return { x, y, title };
  }
  throw new Error('歯車に moment が見つからない');
}

const named = (list, name) => list.filter(e => e.name === name);
const shownPaths = list => named(list, 'view_item_list').flatMap(e => e.items.map(i => i.item_id));

const gear = await openPage({ random: kDial, touch: true });
await gear.goto(`${kOrigin}/`, { waitUntil: 'domcontentloaded' });
await waitEvent(gear, 'gear_ready');
await settle(1300);

// タブが隠れたら、そこまでを送る。見えている 4 つだけで、反対側の k6 は入らない。
await setHidden(gear, true);
let all = await events(gear);
assert.deepEqual(named(all, 'view_item_list').map(e => [e.item_list_id, e.item_list_name]), [['the-gear-of-seasons', '季節の歯車']]);
assert.deepEqual(shownPaths(all).sort(), ['k0', 'k1', 'k2', 'k11'].map(dialPath).sort());
let [leave] = named(all, 'gear_leave');
assert.equal(leave.leave_method, 'hidden');
assert.equal(leave.shown_count, 4);
assert.ok(leave.gear_ms >= 1000, JSON.stringify(leave));
await setHidden(gear, false);
let seen = all.length;

// 0.5 秒以上乗せて離れたら moment_hover。0.5 秒未満なら送らない。
const longHover = await hoverAt(gear, ...kDiscSpots[1]);
assert.ok(longHover !== null);
await settle(700);
await gear.mouse.move(...kEmptySpot);
const hovers = await waitEvent(gear, 'moment_hover');
assert.equal(hovers.length, 1);
assert.equal(hovers[0].moment, dialPath(longHover));
assert.ok(hovers[0].hover_ms >= 500, JSON.stringify(hovers[0]));
assert.ok(await hoverAt(gear, ...kDiscSpots[2]) !== null);
await settle(100);
await gear.mouse.move(...kEmptySpot);
await settle(300);
assert.equal(named(await events(gear), 'moment_hover').length, 1);

// タッチではじいて慣性で回っている間に、マウスを動かしてからホイールで回す。
// 慣性で回った分はタッチに入り、ホイールの分(600px = 30 度)と混ざらない。
await gear.touchscreen.touchStart(600, 300);
for (let i = 1; i <= 5; i++) await gear.touchscreen.touchMove(600, 300 + i * 30);
await gear.touchscreen.touchEnd();
await gear.mouse.move(...kEmptySpot);
await gear.evaluate(() => document.getElementById('background').dispatchEvent(
  new WheelEvent('wheel', { deltaY: 600, deltaMode: 0, cancelable: true })));
await settle(2000);
// 半周回して、反対側の k6 を出す。
await gear.evaluate(() => document.getElementById('background').dispatchEvent(
  new WheelEvent('wheel', { deltaY: 3600, deltaMode: 0, cancelable: true })));
await settle(1300);
await setHidden(gear, true);
all = await events(gear);
let fresh = all.slice(seen);
const firstShown = shownPaths(all.slice(0, seen));
const secondShown = shownPaths(fresh);
assert.ok(secondShown.includes(dialPath('k6')), JSON.stringify(secondShown));
assert.deepEqual(secondShown.filter(p => firstShown.includes(p)), [], '同じ訪問で二度送った');
[leave] = named(fresh, 'gear_leave');
assert.equal(leave.leave_method, 'hidden');
assert.equal(leave.rotate_wheel_deg, 210);
assert.equal(leave.rotate_mouse_deg, 0);
assert.equal(leave.rotate_pen_deg, 0);
assert.ok(leave.rotate_touch_deg > 0, JSON.stringify(leave));
assert.equal(leave.hover_count, 1);
assert.ok(leave.hover_ms >= 500, JSON.stringify(leave));
assert.equal(leave.shown_count, secondShown.length);
await setHidden(gear, false);
seen = all.length;

// 0.5 秒以上乗せてからマウスで開く: view_item_list → gear_leave → select_item → page_view → view_item の順。
const disc = await findDisc(gear);
await settle(700);
await gear.mouse.click(disc.x, disc.y);
await waitPageViews(gear, 2);
all = await events(gear);
fresh = all.slice(seen);
const order = fresh.map(e => e.name).filter(n => !['moment_hover', 'scroll'].includes(n));
assert.deepEqual(order.slice(-4), ['gear_leave', 'select_item', 'page_view', 'view_item'], JSON.stringify(order));
[leave] = named(fresh, 'gear_leave');
assert.equal(leave.leave_method, 'select');
// 開いたものも、迷った回数と時間には入る。
assert.equal(leave.hover_count, 1);
assert.ok(leave.hover_ms >= 500, JSON.stringify(leave));
const [select] = named(fresh, 'select_item');
assert.deepEqual(select, { name: 'select_item', item_list_id: 'the-gear-of-seasons', item_list_name: '季節の歯車',
  items: [{ item_id: dialPath(disc.title), item_name: disc.title }], input: 'mouse' });
assert.ok(shownPaths(all).includes(dialPath(disc.title)));
// 乗せてから開いたものは、moment_hover にしない。
assert.equal(named(all, 'moment_hover').length, 1);
seen = all.length;

// 閉じて歯車に戻ると、数え直す(前の訪問で送ったものも、また送る)。
await gear.click('.close-button');
await waitPageViews(gear, 3);
await settle(1300);
await gear.click('#about-us-link');
await waitPageViews(gear, 4);
all = await events(gear);
fresh = all.slice(seen);
[leave] = named(fresh, 'gear_leave');
assert.equal(leave.leave_method, 'header');
assert.ok(shownPaths(fresh).some(p => shownPaths(all.slice(0, seen)).includes(p)), JSON.stringify(shownPaths(fresh)));
seen = all.length;

// 戻るで歯車に戻り、進むで離れる。
await gear.goBack();
await waitPageViews(gear, 5);
await gear.goForward();
await waitPageViews(gear, 6);
[leave] = named((await events(gear)).slice(seen), 'gear_leave');
assert.equal(leave.leave_method, 'history');
await gear.close();

// 画面の向きが変わって歯車が構図に合わせて回った分は、回した角度に入らない。
// gear_ms には、タブが隠れていた時間が入らない。
const turn = await openPage({ random: kDial });
await turn.goto(`${kOrigin}/`, { waitUntil: 'domcontentloaded' });
await waitEvent(turn, 'gear_ready');
await turn.setViewport({ width: 390, height: 844 });
await settle(500);
await setHidden(turn, true);
[leave] = named(await events(turn), 'gear_leave');
assert.deepEqual([leave.rotate_mouse_deg, leave.rotate_touch_deg, leave.rotate_pen_deg, leave.rotate_wheel_deg], [0, 0, 0, 0]);
await settle(1500);
await setHidden(turn, false);
await settle(300);
await setHidden(turn, true);
const engagements = named(await events(turn), 'gear_leave');
assert.equal(engagements.length, 2);
assert.ok(engagements[1].gear_ms < 1000, JSON.stringify(engagements[1]));
await turn.close();

// 1 秒たつ前にタップで開いたものも、select_item の前に見せたことにする(ほかの見えている moment はまだ入らない)。
const quick = await openPage({ random: kDial, touch: true });
await quick.goto(`${kOrigin}/`, { waitUntil: 'domcontentloaded' });
await waitEvent(quick, 'gear_ready');
await quick.touchscreen.tap(...kDiscSpots[1]);
await waitPageViews(quick, 2);
all = await events(quick);
const [tapped] = named(all, 'select_item');
assert.equal(tapped.input, 'touch');
assert.deepEqual(shownPaths(all), [tapped.items[0].item_id]);
assert.ok(all.findIndex(e => e.name === 'view_item_list') < all.findIndex(e => e.name === 'select_item'));
await quick.close();

// 13) ページ: 表示した moment(view_item)、どこまで読んだか(scroll)、過ごし方(page_leave)。
// どの scroll も、そのページの page_view より後にある(前にあると、前のページの page_location が付く)。
// 直前の page_view・page_leave が、page_view か、タブが隠れた page_leave(戻ってきた後のスクロール)であること。
// view_item は、その moment の page_view のすぐ後にある。
function assertViewItemsRightAfterPageView(list) {
  list.forEach((e, i) => {
    if (e.name === 'view_item') {
      assert.equal(list[i - 1]?.name, 'page_view', JSON.stringify(list.slice(Math.max(0, i - 3), i + 1).map(x => x.name)));
    }
  });
}
function assertScrollsAfterPageView(list) {
  let last = null;
  for (const e of list) {
    if (e.name === 'scroll') {
      assert.ok(last !== null && (last.name === 'page_view' || last.leave_method === 'hidden'),
        JSON.stringify(list.map(x => [x.name, x.leave_method ?? x.percent_scrolled ?? x.page_location])));
    } else if (e.name === 'page_view' || e.name === 'page_leave') {
      last = e;
    }
  }
}
// 13a) 開いた moment は、page_view を本文を待たずに送り、view_item は本文が届いてから送る。
const pages = await openPage();
pages.held.set(`/moment${kMoments[1]}`, null);
await pages.goto(`${kOrigin}${kMoments[1]}`, { waitUntil: 'domcontentloaded' });
await waitPageViews(pages, 1);
await settle(300);
assert.deepEqual(named(await events(pages), 'view_item'), []);
await pages.held.get(`/moment${kMoments[1]}`)();
await waitEvent(pages, 'view_item');
all = await events(pages);
assert.deepEqual(named(all, 'view_item'), [{ name: 'view_item',
  items: [{ item_id: kMoments[1], item_name: kTitles[1] }], nav_via: 'landing' }]);
// スクロールしない短い本文は、表示した時点で全部読んだことにする。
assert.deepEqual(named(await eventsAt(pages), 'scroll'), [25, 50, 75, 100].map(p => ({ name: 'scroll', percent_scrolled: p, at: kMoments[1] })));

// 13b) まえの絵へ: page_leave → page_view → view_item の順。題は絵文字を文字のまま入れる。
await pages.click('a.moment-footer-prev');
await waitPageViews(pages, 2);
await waitEvent(pages, 'view_item');
all = await events(pages);
let [pageLeave] = named(await eventsAt(pages), 'page_leave');
assert.equal(pageLeave.at, kMoments[1]);
assert.equal(pageLeave.leave_method, 'footer_prev');
assert.equal(pageLeave.max_percent_scrolled, 100);
assert.ok(Number.isInteger(pageLeave.page_ms) && pageLeave.page_ms >= 0, JSON.stringify(pageLeave));
const pageOrder = all.filter(e => ['page_leave', 'page_view', 'view_item'].includes(e.name)).map(e => e.name);
assert.deepEqual(pageOrder.slice(-3), ['page_leave', 'page_view', 'view_item']);
assert.deepEqual(named(all, 'view_item')[1], { name: 'view_item',
  items: [{ item_id: kMoments[0], item_name: kTitles[0] }], nav_via: 'footer_prev' });

// 13c) 戻るで離れたときも、page_leave は離れたページに付く(送る時点で URL はもう次のページ)。
// 戻った先の moment は、view_item と scroll を数え直す。
await pages.goBack();
await waitPageViews(pages, 3);
let layerLog = await pages.evaluate(() => window.dataLayer.map(args => Array.from(args)));
const historyLeave = layerLog.findIndex(a => a[0] === 'event' && a[1] === 'page_leave' && a[2].leave_method === 'history');
assert.ok(historyLeave >= 0);
assert.deepEqual(layerLog.slice(0, historyLeave).filter(a => a[0] === 'set').at(-1),
  ['set', { page_location: `${kOrigin}${kMoments[0]}`, page_title: pageTitle(kTitles[0]) }]);
all = await events(pages);
assert.deepEqual(named(all, 'view_item').at(-1), { name: 'view_item',
  items: [{ item_id: kMoments[1], item_name: kTitles[1] }], nav_via: 'history' });
assert.equal(named(all, 'scroll').filter(e => e.percent_scrolled === 100).length, 3);

// 13d) タブを隠すと engagement を区切り、隠れていた時間は page_ms に入れない。
seen = all.length;
await setHidden(pages, true);
[pageLeave] = named((await events(pages)).slice(seen), 'page_leave');
assert.equal(pageLeave.leave_method, 'hidden');
await settle(1500);
await setHidden(pages, false);
await settle(300);
await pages.click('.close-button');
await waitPageViews(pages, 4);
all = await events(pages);
let leaves = named(all.slice(seen), 'page_leave');
assert.equal(leaves.length, 2);
assert.equal(leaves[1].leave_method, 'close_button');
assert.ok(leaves[1].page_ms < 1000, JSON.stringify(leaves[1]));
assert.equal(leaves[1].max_percent_scrolled, 100);

// 13e) 本文が届く前に離れたページは page_view を送らないので、page_leave も送らない(送ると下のページの
// page_location が付く)。後から届いても scroll と view_item は送らない。
seen = all.length;
pages.held.set('/static/shop.html', null);
await pages.click('#shop-link');
await settle(300);
await pages.click('.close-button');
await waitPageViews(pages, 5);
await pages.held.get('/static/shop.html')();
await settle(500);
all = (await events(pages)).slice(seen);
assert.deepEqual(named(all, 'page_leave'), []);
assert.deepEqual(named(all, 'scroll'), []);
assert.deepEqual(named(all, 'view_item'), []);

// 13f) moment 以外のページは view_item を送らない。scroll と page_leave には、そのページの page_location が付く。
seen = (await events(pages)).length;
await pages.click('#about-us-link');
await waitPageViews(pages, 6);
await settle(300);
await pages.evaluate(() => document.getElementById('background').dispatchEvent(new MouseEvent('mouseup')));
await waitPageViews(pages, 7);
all = (await eventsAt(pages)).slice(seen);
assert.deepEqual(named(all, 'view_item'), []);
assert.ok(named(all, 'scroll').length > 0 && named(all, 'scroll').every(e => e.at === '/about-us/'), JSON.stringify(named(all, 'scroll')));
assert.deepEqual(named(all, 'page_leave').map(e => [e.at, e.leave_method]), [['/about-us/', 'backdrop']]);
assertScrollsAfterPageView(await events(pages));
assertViewItemsRightAfterPageView(await events(pages));
await pages.close();

// 13h) 戻るで 2 枚以上を一度に下ろすとき、途中のレイヤは最上位にしない(page_leave・gear_leave・scroll を送らない)。
const stack = await openPage();
await stack.goto(`${kOrigin}${kMoments[1]}`, { waitUntil: 'domcontentloaded' });
await waitPageViews(stack, 1);
await stack.click('a.moment-footer-prev');
await waitPageViews(stack, 2);
await stack.click('.moment-footer-gear');
await waitPageViews(stack, 3);
await stack.click('#about-us-link');
await waitPageViews(stack, 4);
seen = (await events(stack)).length;
// スタックは [ふたつめ, ひとつめ, 歯車, About us]。ふたつめまで戻ると、ひとつめと歯車は通るだけ。
await stack.evaluate(() => history.go(-3));
views = await waitPageViews(stack, 5);
assert.equal(views[4].page_location, `${kOrigin}${kMoments[1]}`);
await settle(500);
all = (await eventsAt(stack)).slice(seen);
assert.deepEqual(all.filter(e => e.name === 'page_leave' || e.name === 'gear_leave').map(e => [e.name, e.at, e.leave_method]),
  [['page_leave', '/about-us/', 'history']]);
assertScrollsAfterPageView(await events(stack));
assertViewItemsRightAfterPageView(await events(stack));
await stack.close();

// 13g) 長い本文: 画像が読み込まれるまでは測らない(読み込む前の画像は高さが 0 で、本文が短く見える)。
// 閾値は越えたときに 1 回ずつ送る。
const longPage = await openPage();
longPage.held.set('/entity/tall/medium', null);
await longPage.goto(`${kOrigin}${kLongMoment}`, { waitUntil: 'domcontentloaded' });
await waitEvent(longPage, 'view_item');
await settle(300);
assert.deepEqual(named(await events(longPage), 'scroll'), []);
await longPage.held.get('/entity/tall/medium')();
await longPage.waitForFunction(() => document.querySelector('.content img.embed').complete);
await settle(300);
assert.deepEqual(named(await events(longPage), 'scroll'), [], '画像が読み込まれると本文が伸びる');
const scrollTo = fraction => longPage.evaluate(f => {
  const c = document.querySelector('.content');
  c.scrollTop = (c.scrollHeight - c.clientHeight) * f;
}, fraction);
await scrollTo(0.5);
await settle(300);
assert.deepEqual(named(await events(longPage), 'scroll').map(e => e.percent_scrolled), [25, 50]);
await scrollTo(1);
await settle(300);
await scrollTo(0);
await settle(300);
await scrollTo(1);
await settle(300);
assert.deepEqual(named(await events(longPage), 'scroll').map(e => e.percent_scrolled), [25, 50, 75, 100]);
// 上に戻ってから離れても、いちばん深い位置は 100% のまま。
await scrollTo(0);
await settle(300);
await longPage.click('.close-button');
await waitPageViews(longPage, 2);
[pageLeave] = named(await events(longPage), 'page_leave');
assert.equal(pageLeave.max_percent_scrolled, 100);
await longPage.close();

// 14) メディア: 表示ごと・メディアごとに、初めての再生(media_start)、25/50/75 %(media_progress)、
// 最後まで(media_complete)を 1 回ずつ送る。
const mediaPage = await openPage();
const mediaEvents = async () => (await eventsAt(mediaPage)).filter(e => e.name.startsWith('media_'));
const mediaLog = list => list.map(e => [e.name, e.entity, e.media_percent].filter(x => x !== undefined));
const logOf = entity => [['media_start', entity], ['media_progress', entity, 25], ['media_progress', entity, 50],
  ['media_progress', entity, 75], ['media_complete', entity]];
const kAudio = '.content audio:nth-of-type(1)';
const kAudioTwin = '.content audio:nth-of-type(2)';
const kVideo = '.content video[data-entity="vid"]';
const kFastVideo = '.content video[data-entity="fast"]';
// from を渡すとそこから、渡さなければ今の位置から再生する。
const play = (selector, from) => mediaPage.evaluate(async (sel, t) => {
  const el = document.querySelector(sel);
  el.muted = true;
  if (t !== null) {
    el.currentTime = t;
  }
  await el.play();
}, selector, from ?? null);
const pause = selector => mediaPage.evaluate(sel => document.querySelector(sel).pause(), selector);
// 止めたまま位置を動かし、動いた位置を返す。
const seek = (selector, t) => mediaPage.evaluate(async (sel, t) => {
  const el = document.querySelector(sel);
  el.currentTime = t;
  await new Promise(r => el.addEventListener('seeked', r, { once: true }));
  return el.currentTime;
}, selector, t);
// 表示を数え直した後の分も数えられるよう、通算の件数で待つ。
const waitMedia = (name, entity, count = 1) => mediaPage.waitForFunction(
  (n, e, k) => window.dataLayer.filter(a => a[0] === 'event' && a[1] === n && a[2].entity === e).length >= k,
  { timeout: 10000 }, name, entity, count);
await mediaPage.goto(`${kOrigin}${kMediaMoment}`, { waitUntil: 'domcontentloaded' });
await waitPageViews(mediaPage, 1);
await mediaPage.waitForFunction(() => Array.from(document.querySelectorAll('.content audio, .content video')).every(el => el.readyState >= 1));
// 14a) 再生する前に位置を動かしても送らない。
assert.ok(Math.abs(await seek(kAudio, 1.1) - 1.1) < 0.05, '位置を動かせていない');
await settle(300);
assert.deepEqual(await mediaEvents(), []);
// 14b) 音声: 最後まで再生すると、start → 25・50・75 → complete。もう一度再生しても、
// 同じ entity のもう 1 つを再生しても送らない。
await play(kAudio, 0);
await waitMedia('media_complete', 'aud');
assert.deepEqual(mediaLog(await mediaEvents()), logOf('aud'));
assert.ok((await mediaEvents()).every(e => e.platform === 'internal' && e.media_type === 'audio' && e.at === kMediaMoment));
await play(kAudio, 0);
await play(kAudioTwin, 0);
await settle(1600);
assert.deepEqual(mediaLog(await mediaEvents()), logOf('aud'), 'もう一度再生しても、同じ entity のもう 1 つでも送らない');
// 14c) 再生が始まった後でも、止めたまま位置を動かしたものは数えない。
let mediaSeen = (await mediaEvents()).length;
await play(kVideo, 0);
await waitMedia('media_start', 'vid');
await pause(kVideo);
const afterPause = (await mediaEvents()).length;
assert.ok(Math.abs(await seek(kVideo, 1.0) - 1.0) < 0.05, '位置を動かせていない');
await settle(300);
assert.equal((await mediaEvents()).length, afterPause, '止めたまま動かした位置は数えない');
// 14d) loop の動画は ended が来ないので、終わりの手前で complete にする。2 周目は送らない。
await play(kVideo);
await waitMedia('media_complete', 'vid');
await settle(1500);
await pause(kVideo);
assert.deepEqual(mediaLog((await mediaEvents()).slice(mediaSeen)), logOf('vid'));
assert.ok((await mediaEvents()).slice(mediaSeen).every(e => e.media_type === 'video'));
// 14e) 倍速の loop の動画は、timeupdate の間に進む分だけ、終わりの幅を広げる。timeupdate の来る位置は
// 実際に再生すると決まらないので、要素の値を差し替えて起こす(4 秒の動画の 3.4 秒、残り 0.6 秒)。
mediaSeen = (await mediaEvents()).length;
const fakeTimeUpdate = rate => mediaPage.evaluate((sel, r) => {
  const el = document.querySelector(sel);
  Object.defineProperty(el, 'paused', { configurable: true, get: () => false });
  Object.defineProperty(el, 'currentTime', { configurable: true, get: () => 3.4 });
  Object.defineProperty(el, 'playbackRate', { configurable: true, get: () => r });
  el.dispatchEvent(new Event('playing'));
  el.dispatchEvent(new Event('timeupdate'));
}, kFastVideo, rate);
await fakeTimeUpdate(1);
assert.deepEqual(mediaLog((await mediaEvents()).slice(mediaSeen)), logOf('fast').slice(0, 4), '1 倍速なら残り 0.6 秒はまだ終わりでない');
await fakeTimeUpdate(2);
assert.deepEqual(mediaLog((await mediaEvents()).slice(mediaSeen)), logOf('fast'), '2 倍速なら残り 0.6 秒は終わり');
// 14f) 戻るで同じページに戻ると数え直す。タブが隠れても(engagement が分かれても)、その表示の中では続きから数える。
mediaSeen = (await mediaEvents()).length;
await mediaPage.click('.moment-footer-gear');
await waitPageViews(mediaPage, 2);
await mediaPage.goBack();
await waitPageViews(mediaPage, 3);
await play(kAudio, 0);
await waitMedia('media_start', 'aud', 2);
await pause(kAudio);
await setHidden(mediaPage, true);
await setHidden(mediaPage, false);
await play(kAudio);
await waitMedia('media_complete', 'aud', 2);
assert.deepEqual(mediaLog((await mediaEvents()).slice(mediaSeen)), logOf('aud'));
assert.ok((await mediaEvents()).every(e => e.at === kMediaMoment));
// 14g) 離れた後は送らない。離れたページの要素は DOM から外れるが、本文の中にあるので、イベントは Page に届く。
// この表示でまだ再生していない動画で確かめる(音声は、この表示でもう送り終えている)。
mediaSeen = (await mediaEvents()).length;
await mediaPage.evaluate(sel => { window.detachedVideo = document.querySelector(sel); }, kVideo);
await mediaPage.click('.close-button');
await waitPageViews(mediaPage, 4);
await mediaPage.evaluate(async () => {
  const el = window.detachedVideo;
  el.muted = true; el.currentTime = 0; await el.play();
});
await settle(1600);
assert.deepEqual((await mediaEvents()).slice(mediaSeen), [], '離れたページのメディアは送らない');
await mediaPage.close();

// 10) WebGL が使えなければ、fatal の exception だけを送る。
const noGL = await openPage({ noWebGL: true });
await noGL.goto(`${kOrigin}/`, { waitUntil: 'domcontentloaded' });
await waitEvent(noGL, 'exception');
await settle(500);
assert.deepEqual(await events(noGL), [{ name: 'exception', description: 'webgl_unsupported', fatal: true }]);
await noGL.close();

// 11) 運営者の印の Cookie があれば、どのイベントよりも先に traffic_type と debug_mode を set する。
// Cookie はこのブラウザのほかのページにも残るので、最後に試す。
const internal = await openPage();
await internal.setCookie({ name: 'xgear_internal', value: '1', url: kOrigin });
await internal.goto(`${kOrigin}/`, { waitUntil: 'domcontentloaded' });
await waitPageViews(internal, 1);
const trafficTypeSets = list => list.filter(args => args[0] === 'set' && 'traffic_type' in args[1]);
assert.deepEqual(trafficTypeSets(await commands(internal, 'set')), [], '名前の違う Cookie は印にしない');
await internal.setCookie({ name: 'gear_internal', value: '1', url: kOrigin });
await internal.goto(`${kOrigin}/`, { waitUntil: 'domcontentloaded' });
await waitPageViews(internal, 1);
const layer = await internal.evaluate(() => window.dataLayer.map(args => Array.from(args)));
assert.deepEqual(layer[0], ['set', { traffic_type: 'internal', debug_mode: true }]);
assert.equal(trafficTypeSets(layer).length, 1);
await internal.close();

// 測定 ID が無いシェルなので、gtag.js は読み込まない(外へのリクエストは twemoji の画像だけ)。
assert.deepEqual(outside.filter(href => !href.startsWith('https://cdnjs.cloudflare.com/ajax/libs/twemoji/')), []);

await browser.close();
console.log('ok');
