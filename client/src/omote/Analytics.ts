// omote から GA4 へ送るイベント。
//
// gtag() は index.hbs が定義する。測定 ID があるときだけサーバが gtag.js を読み込ませるので、
// 送るかどうかはここでは決めない。ID が無い(開発環境)と、イベントは window.dataLayer に
// 溜まるだけになり、tools/preview/analytics.mjs はそれを読んで確かめる。
//
// GA の管理画面で、拡張計測の「ブラウザの履歴イベントに基づくページの変更」を OFF にしておくこと。
// ON だと、ここで送る page_view と重複して数えられる。

import { glMatrix } from 'gl-matrix';

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

let lastLocation: string | null = null;

function send(name: string, params: Record<string, unknown>) {
  window.gtag?.('event', name, params);
}

/**
 * page_view を送る。SPA の遷移ごとに、そのページの題が決まってから呼ぶ。
 * location は、landing なら開いた URL そのもの(UTM などのクエリは、最初の page_view の
 * page_location に入っていないと流入元に数えられない)、それ以外はそのページの URL。
 * page_referrer は、遷移の前のページ(最初の page_view では GA が document.referrer を使う)。
 */
export function pageView(location: string, title: string, via: NavVia) {
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

/**
 * moment を商品(item)として並べた一覧。GA の推奨イベント(view_item_list / select_item)の
 * item_list_id と item_list_name。item_id は moment のパス、item_name は題で、どの一覧でも同じ。
 */
export type MomentItemList = { id: string, name: string };
export const kGearItemList: MomentItemList = { id: 'the-gear-of-seasons', name: '季節の歯車' };

export type ListedMoment = { path: string, title: string };

// items は 1 イベント 200 個までだが、gtag の 1 回のリクエストの大きさの上限は書かれていないので小さく分ける。
const kItemsPerEvent = 50;

/** GA の items に入れる 1 個分。 */
type GAItem = { item_id: string, item_name: string };

function itemOf(m: ListedMoment): GAItem {
  return { item_id: m.path, item_name: m.title };
}

/** 一覧で見せた moment(GA の view_item_list)。空なら送らない。 */
export function viewMomentList(list: MomentItemList, moments: readonly ListedMoment[]) {
  for (let i = 0; i < moments.length; i += kItemsPerEvent) {
    send('view_item_list', {
      item_list_id: list.id,
      item_list_name: list.name,
      items: moments.slice(i, i + kItemsPerEvent).map(itemOf),
    });
  }
}

/**
 * ポインタの種類。PointerEvent.pointerType は mouse・pen・touch のほか、機器の種類が分からないと空文字列に、
 * それ以外の機器ではベンダー接頭辞の付いた値になりうる。その 2 つは touch に含める
 * (歯車はマウス以外をタッチと同じに扱い、ツールチップを出さずにタップで開くため)。
 */
export type PointerInput = 'mouse' | 'touch' | 'pen';

export function pointerInputOf(pointerType: string): PointerInput {
  return pointerType === 'mouse' || pointerType === 'pen' ? pointerType : 'touch';
}

/** 一覧から開いた moment(GA の select_item)。 */
export function selectMoment(list: MomentItemList, moment: ListedMoment, input: PointerInput) {
  send('select_item', {
    item_list_id: list.id,
    item_list_name: list.name,
    items: [itemOf(moment)],
    input,
  });
}

/** 歯車を回した入力。ドラッグの後の慣性は、そのドラッグの入力に含める。 */
export type RotateInput = PointerInput | 'wheel';

/**
 * 歯車を離れた手段(gear_leave の exit)。
 *
 * - select: 歯車の moment を開いた
 * - header: 歯車の上の About us・えらんだ絵・お店
 * - history: ブラウザの戻る・進む
 * - hidden: タブが隠れた(戻ってきたら、その後の分は次の gear_leave に入る)
 */
export type GearExitMethod = 'select' | 'header' | 'history' | 'hidden';

/** gear_leave 1 件分。歯車の engagement 1 回分(GearEngagement)の要約。 */
export type GearEngagementSummary = {
  exit: GearExitMethod;
  // この engagement で歯車にいた時間。タブが隠れていた時間は含まない。
  gearMs: number;
  // 入力ごとに回した角度(絶対値の合計、ラジアン)。
  rotationByInput: Readonly<Record<RotateInput, number>>;
  // この engagement で 0.5 秒以上マウスを乗せた回数と、その時間の合計(開いたものも含む)。
  hoverCount: number;
  hoverMs: number;
  // この engagement の view_item_list で送った moment の数(前の engagement で送ったものは含まない)。
  shownCount: number;
};

/** 歯車での過ごし方の要約。engagement ごと(歯車を離れたとき、タブが隠れたとき)に 1 件送る。 */
export function gearLeave(summary: GearEngagementSummary) {
  const deg = (rad: number) => Math.round(glMatrix.toDegree(rad));
  send('gear_leave', {
    exit: summary.exit,
    gear_ms: Math.round(summary.gearMs),
    rotate_mouse_deg: deg(summary.rotationByInput.mouse),
    rotate_touch_deg: deg(summary.rotationByInput.touch),
    rotate_pen_deg: deg(summary.rotationByInput.pen),
    rotate_wheel_deg: deg(summary.rotationByInput.wheel),
    hover_count: summary.hoverCount,
    hover_ms: Math.round(summary.hoverMs),
    shown_count: summary.shownCount,
  });
}

/** マウスを 0.5 秒以上乗せたのに、開かずに離れた moment。 */
export function momentHover(path: string, hoverMs: number) {
  send('moment_hover', { moment: path, hover_ms: Math.round(hoverMs) });
}
