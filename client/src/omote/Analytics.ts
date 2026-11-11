// omote から GA4 へ送るイベント。
//
// gtag() は index.hbs が定義する。測定 ID があるときだけサーバが gtag.js を読み込ませるので、
// 送るかどうかはここでは決めない。ID が無い(開発環境)と、イベントは window.dataLayer に
// 溜まるだけになり、tools/preview/analytics.mjs はそれを読んで確かめる。
//
// GA の管理画面で、拡張計測の「ブラウザの履歴イベントに基づくページの変更」を OFF にしておくこと。
// ON だと、ここで送る page_view と重複して数えられる。

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * そのページにどうやって来たか。page_view の nav_via に入れる。
 *
 * - landing: URL を開いた(リロードと、ページを読み込み直すリンクを含む)
 * - history: ブラウザの戻る・進む
 * - gear: 歯車の moment をクリック・タップした
 * - header: 歯車の上の About us・えらんだ絵・お店
 * - footer_prev / footer_next: moment の下の「まえの絵」「つぎの絵」
 * - footer_gear: moment の下の「歯車にもどる」
 * - footer_link: moment の下の「えらんだ絵をみる」「お店」
 * - close_button: ページ右上の × ボタン
 * - backdrop: ページの外(歯車の canvas)をクリックして閉じた
 */
export type NavVia =
  | 'landing'
  | 'history'
  | 'gear'
  | 'header'
  | 'footer_prev'
  | 'footer_next'
  | 'footer_gear'
  | 'footer_link'
  | 'close_button'
  | 'backdrop';

// 開いた URL。UTM などのクエリは、最初の page_view の page_location に入っていないと流入元に数えられない。
const kLandingHref = window.location.href;

let lastLocation: string | null = null;

function send(name: string, params: Record<string, unknown>) {
  window.gtag?.('event', name, params);
}

/**
 * page_view を送る。SPA の遷移ごとに、そのページの題が決まってから呼ぶ。
 * page_referrer は、遷移の前のページ(最初の page_view では GA が document.referrer を使う)。
 */
export function pageView(path: string, title: string, via: NavVia) {
  const location = via === 'landing' ? kLandingHref : window.location.origin + path;
  send('page_view', {
    page_location: location,
    page_title: title,
    ...(lastLocation !== null ? { page_referrer: lastLocation } : {}),
    nav_via: via,
  });
  lastLocation = location;
}

/**
 * GA4 の推奨イベント exception。description は、GA の画面で読める短い識別子(と、あればパス)にする。
 * fatal は、サイトをまったく見られなくなったもの(WebGL が使えない)だけ true にする。
 */
export function exception(description: string, fatal: boolean) {
  send('exception', { description, fatal });
}

/** 歯車に moment が 1 つ以上描かれた。load_ms は歯車のレイヤを作ってからの時間。 */
export function gearReady(loadMs: number) {
  send('gear_ready', { load_ms: Math.round(loadMs) });
}
