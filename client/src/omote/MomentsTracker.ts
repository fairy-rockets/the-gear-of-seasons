import Moment from './actors/Moment';
import * as analytics from './Analytics';

// 円の中心が画面内に、続けてこれだけあったら「見せた」とする(IAB の viewability の目安に合わせた)。
const kShownAfterMs = 1000;
// これ以上マウスを乗せたら、題を読んで開くか考えたとみなす。
const kHoverMinMs = 500;

/**
 * 歯車で見せた moment と、マウスを乗せた moment を数える。Index が 1 つ持つ。
 *
 * 見せた moment は溜めておき、flush で view_item_list として送る。1 回の訪問(begin から次の begin まで)の
 * 中では同じ moment を二度送らない。マウスを乗せたものと開いたものは、画面にあった時間に関わらず見せたことにする
 * (円の端だけが画面に入っていても当たるため。開いたのに見せていないと、クリック率が 1 を超える)。
 */
export default class MomentsTracker {
  private readonly list_: analytics.MomentList;
  // この訪問で view_item_list に入れた(入れる) moment のパス。
  private readonly shown_: Set<string>;
  // 見せたが、まだ送っていない moment。
  private pending_: analytics.ListedMoment[];
  // 円の中心が画面内に入り続けている moment と、入った時刻。
  private readonly onScreenSince_: Map<Moment, number>;
  // マウスを乗せている moment と、乗せ始めた時刻。
  private hover_: { moment: Moment, since: number } | null;
  // 前の flush から後の、0.5 秒以上乗せた回数と時間。
  private hoverCount_: number;
  private hoverMs_: number;
  constructor(list: analytics.MomentList) {
    this.list_ = list;
    this.shown_ = new Set();
    this.pending_ = [];
    this.onScreenSince_ = new Map();
    this.hover_ = null;
    this.hoverCount_ = 0;
    this.hoverMs_ = 0;
  }

  /** 訪問を始める。前の訪問で見せたものも、もう一度数える。 */
  begin() {
    this.shown_.clear();
    this.pending_ = [];
    this.onScreenSince_.clear();
    this.hover_ = null;
    this.hoverCount_ = 0;
    this.hoverMs_ = 0;
  }

  /** 毎フレーム、円の中心が画面内にある moment を渡す。 */
  frame(now: number, onScreen: readonly Moment[]) {
    const since = this.onScreenSince_;
    const current = new Set(onScreen);
    for (const m of Array.from(since.keys())) {
      if (!current.has(m)) {
        since.delete(m);
      }
    }
    for (const m of onScreen) {
      const start = since.get(m);
      if (start === undefined) {
        since.set(m, now);
      } else if (now - start >= kShownAfterMs) {
        this.markShown(m);
      }
    }
  }

  /** 画面にあった時間に関わらず、見せたことにする。 */
  markShown(m: Moment) {
    if (this.shown_.has(m.path)) {
      return;
    }
    this.shown_.add(m.path);
    this.pending_.push({ path: m.path, title: m.title });
  }

  /** マウスを乗せた moment が変わった(null は外れた)。 */
  hover(now: number, m: Moment | null) {
    if (this.hover_?.moment === m) {
      return;
    }
    this.endHover_(now, false);
    if (m !== null) {
      this.markShown(m);
      this.hover_ = { moment: m, since: now };
    }
  }

  /** moment を開いた。乗せていたなら、開かなかった moment_hover は送らない。 */
  open(now: number, m: Moment) {
    this.markShown(m);
    if (this.hover_?.moment === m) {
      this.endHover_(now, true);
    }
  }

  /**
   * 溜めた分を送る(歯車を離れたとき、タブが隠れたとき)。乗せている途中の moment は、ここで離れたことにする。
   * gear_leave に入れる数を返し、数え直す。
   */
  flush(now: number): { hoverCount: number, hoverMs: number, shownCount: number } {
    this.endHover_(now, false);
    // 隠れている間は描かれないので、入り続けていた時間はここで切る。
    this.onScreenSince_.clear();
    analytics.viewMomentList(this.list_, this.pending_);
    const counts = {
      hoverCount: this.hoverCount_,
      hoverMs: this.hoverMs_,
      shownCount: this.pending_.length,
    };
    this.pending_ = [];
    this.hoverCount_ = 0;
    this.hoverMs_ = 0;
    return counts;
  }

  private endHover_(now: number, opened: boolean) {
    const hover = this.hover_;
    if (hover === null) {
      return;
    }
    this.hover_ = null;
    const ms = now - hover.since;
    if (ms < kHoverMinMs) {
      return;
    }
    ++this.hoverCount_;
    this.hoverMs_ += ms;
    if (!opened) {
      analytics.momentHover(hover.moment.path, ms);
    }
  }
}
