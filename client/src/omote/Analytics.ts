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
 *
 * 送った後、page_location と page_title を set し、次の page_view までのイベントをこのページに付ける。
 * gtag は何もしなければ送った時点の URL を付けるが、戻る・進むで離れたときは、離れたページの
 * page_leave などを送る時点で URL がもう次のページになっている。set する URL からはクエリを外す
 * (UTM を後のイベントにまで付けない)。
 */
export function pageView(location: string, title: string, via: NavVia) {
  send('page_view', {
    page_location: location,
    page_title: title,
    ...(lastLocation !== null ? { page_referrer: lastLocation } : {}),
    nav_via: via,
  });
  lastLocation = location;
  const url = new URL(location);
  url.search = '';
  url.hash = '';
  window.gtag?.('set', { page_location: url.href, page_title: title });
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

/** GA の item としての moment。 */
export type MomentItem = { path: string, title: string };

// GA4 が書いている、1 イベントの items の上限。これを超えたときだけ分ける(分けると、一覧の表示回数
// itemListViewEvents はイベントの数で数えるので、その分増える)。
const kItemsPerEvent = 200;

/** GA の items に入れる 1 個分。 */
type GAItem = { item_id: string, item_name: string };

function itemOf(m: MomentItem): GAItem {
  return { item_id: m.path, item_name: m.title };
}

/** 一覧で見せた moment(GA の view_item_list)。空なら送らない。 */
export function viewMomentList(list: MomentItemList, moments: readonly MomentItem[]) {
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
export function selectMoment(list: MomentItemList, moment: MomentItem, input: PointerInput) {
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
 * 歯車を離れた手段(gear_leave の leave_method)。GA4 の exit(離脱数)はセッションの最後のイベントが
 * あったページのことで、サイトの中で別のページへ移ることは含まないので、exit とは呼ばない。
 *
 * - select: 歯車の moment を開いた
 * - header: 歯車の上の About us・えらんだ絵・お店
 * - history: ブラウザの戻る・進む
 * - hidden: タブが隠れた(戻ってきたら、その後の分は次の gear_leave に入る)
 */
export type GearLeaveMethod = 'select' | 'header' | 'history' | 'hidden';

/** gear_leave 1 件分。歯車の engagement 1 回分(GearEngagement)の要約。 */
export type GearEngagementSummary = {
  leaveMethod: GearLeaveMethod;
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
  // 1 度単位に丸める(GA が求めているわけではない。読みやすさと送る量のため。engagement ごとの誤差は
  // 0.5 度未満で、足し合わせても無視できる)。gear_ms・hover_ms も同じくミリ秒単位に丸める。
  const deg = (rad: number) => Math.round(glMatrix.toDegree(rad));
  send('gear_leave', {
    leave_method: summary.leaveMethod,
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

/** moment を表示した(GA の view_item)。page_view の後に送る。 */
export function viewMoment(moment: MomentItem, via: NavVia) {
  send('view_item', { items: [itemOf(moment)], nav_via: via });
}

/**
 * ページを離れた手段(page_leave の leave_method)。そのページから移った遷移の NavVia か、
 * タブが隠れた(hidden。戻ってきたら、その後の分は次の page_leave に入る)。
 */
export type PageLeaveMethod =
  | 'history'
  | 'footer_prev'
  | 'footer_next'
  | 'footer_gear'
  | 'footer_link'
  | 'close_button'
  | 'backdrop'
  | 'hidden';

/** page_leave 1 件分。ページの engagement 1 回分(PageEngagement)の要約。 */
export type PageEngagementSummary = {
  leaveMethod: PageLeaveMethod;
  // この engagement でページにいた時間。タブが隠れていた時間は含まない。
  pageMs: number;
  // この engagement の終わりまでに届いた、いちばん深いスクロールの位置(0〜100)。この表示の中で数える。
  maxPercentScrolled: number;
};

/** ページでの過ごし方の要約。engagement ごと(ページを離れたとき、タブが隠れたとき)に 1 件送る。 */
export function pageLeave(summary: PageEngagementSummary) {
  send('page_leave', {
    leave_method: summary.leaveMethod,
    page_ms: Math.round(summary.pageMs),
    max_percent_scrolled: summary.maxPercentScrolled,
  });
}

/**
 * ページの本文を percent(25・50・75・100)まで読んだ。GA の拡張計測のスクロール数と同じ名前にした
 * (拡張計測は window のスクロールを見るが、このサイトでは window はスクロールしないので、何も送らない)。
 */
export function scroll(percentScrolled: number) {
  send('scroll', { percent_scrolled: percentScrolled });
}

/**
 * 再生を数えるメディア 1 つ。entity は entity の id、platform は置き場所(internal は中のファイル、
 * それ以外は外の動画の external_ref.platform)。GA の動画のイベントの video_provider に当たるが、
 * 音声も入るので media_ にし、DB と同じ platform の名前にした。
 */
export type PlayedMedia = {
  entity: string;
  mediaType: 'video' | 'audio';
  platform: 'internal' | 'youtube';
};

// GA に送るパラメータとしての media。
function mediaParamsOf(media: PlayedMedia) {
  return { entity: media.entity, media_type: media.mediaType, platform: media.platform };
}

/** メディアを、その表示で初めて再生した。 */
export function mediaStart(media: PlayedMedia) {
  send('media_start', mediaParamsOf(media));
}

/**
 * メディアを、その表示で percent(25・50・75)まで初めて再生した。
 * GA の拡張計測の video_progress(video_percent)に合わせた名前。
 */
export function mediaProgress(media: PlayedMedia, percent: number) {
  send('media_progress', { ...mediaParamsOf(media), media_percent: percent });
}

/** メディアを、その表示で初めて最後まで再生した。 */
export function mediaComplete(media: PlayedMedia) {
  send('media_complete', mediaParamsOf(media));
}
