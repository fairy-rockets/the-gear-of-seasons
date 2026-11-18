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
// 運営者の印の Cookie が無ければ、gtag('set') は積まない。
assert.deepEqual(await commands(page, 'set'), []);
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
assert.deepEqual(named(all, 'view_item_list').map(e => [e.item_list_id, e.item_list_name]), [['gear', '歯車']]);
assert.deepEqual(shownPaths(all).sort(), ['k0', 'k1', 'k2', 'k11'].map(dialPath).sort());
let [leave] = named(all, 'gear_leave');
assert.equal(leave.exit, 'hidden');
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
assert.equal(leave.exit, 'hidden');
assert.equal(leave.rotate_wheel_deg, 210);
assert.equal(leave.rotate_mouse_deg, 0);
assert.equal(leave.rotate_pen_deg, 0);
assert.ok(leave.rotate_touch_deg > 0, JSON.stringify(leave));
assert.equal(leave.hover_count, 1);
assert.ok(leave.hover_ms >= 500, JSON.stringify(leave));
assert.equal(leave.shown_count, secondShown.length);
await setHidden(gear, false);
seen = all.length;

// 0.5 秒以上乗せてからマウスで開く: view_item_list → gear_leave → select_item → page_view の順。
const disc = await findDisc(gear);
await settle(700);
await gear.mouse.click(disc.x, disc.y);
await waitPageViews(gear, 2);
all = await events(gear);
fresh = all.slice(seen);
const order = fresh.map(e => e.name).filter(n => n !== 'moment_hover');
assert.deepEqual(order.slice(-3), ['gear_leave', 'select_item', 'page_view'], JSON.stringify(order));
[leave] = named(fresh, 'gear_leave');
assert.equal(leave.exit, 'select');
// 開いたものも、迷った回数と時間には入る。
assert.equal(leave.hover_count, 1);
assert.ok(leave.hover_ms >= 500, JSON.stringify(leave));
const [select] = named(fresh, 'select_item');
assert.deepEqual(select, { name: 'select_item', item_list_id: 'gear', item_list_name: '歯車',
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
assert.equal(leave.exit, 'header');
assert.ok(shownPaths(fresh).some(p => shownPaths(all.slice(0, seen)).includes(p)), JSON.stringify(shownPaths(fresh)));
seen = all.length;

// 戻るで歯車に戻り、進むで離れる。
await gear.goBack();
await waitPageViews(gear, 5);
await gear.goForward();
await waitPageViews(gear, 6);
[leave] = named((await events(gear)).slice(seen), 'gear_leave');
assert.equal(leave.exit, 'history');
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
const parts = named(await events(turn), 'gear_leave');
assert.equal(parts.length, 2);
assert.ok(parts[1].gear_ms < 1000, JSON.stringify(parts[1]));
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
assert.deepEqual(await commands(internal, 'set'), [], '名前の違う Cookie は印にしない');
await internal.setCookie({ name: 'gear_internal', value: '1', url: kOrigin });
await internal.goto(`${kOrigin}/`, { waitUntil: 'domcontentloaded' });
await waitPageViews(internal, 1);
const layer = await internal.evaluate(() => window.dataLayer.map(args => Array.from(args)));
assert.deepEqual(layer[0], ['set', { traffic_type: 'internal', debug_mode: true }]);
assert.equal(layer.filter(args => args[0] === 'set').length, 1);
await internal.close();

// 測定 ID が無いシェルなので、gtag.js は読み込まない(外へのリクエストは twemoji の画像だけ)。
assert.deepEqual(outside.filter(href => !href.startsWith('https://cdnjs.cloudflare.com/ajax/libs/twemoji/')), []);

await browser.close();
console.log('ok');
