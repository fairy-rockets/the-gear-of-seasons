import Moment from './actors/Moment';
import * as analytics from './Analytics';

// 円の中心がビューポートの中に、続けてこれだけあったら表示した(impression)とする(IAB の viewability の目安に合わせた)。
const kImpressionAfterMs = 1000;
// これ以上マウスを乗せたら、題を読んで開くか考えたとみなす。
const kHoverMinMs = 500;

/**
 * 歯車の engagement 1 回分で、表示した moment と、マウスを乗せた moment を数える。GearEngagement が持つ。
 *
 * 表示した moment は溜めておき、end で view_item_list として送る。訪問の中で同じ moment を二度送らないよう、
 * 表示した moment のパスは訪問の間の集合(impressedMomentPaths_)に入れ、そこにあるものは溜めない。
 * マウスを乗せたものと開いたものは、ビューポートにあった時間に関わらず表示したことにする
 * (円の端だけがビューポートに入っていても当たるため。開いたのに表示していないと、クリック率が 1 を超える)。
 */
export default class MomentsTracker {
  private readonly momentList_: analytics.MomentItemList;
  // この訪問で表示した moment のパス(前の engagement で送ったものも含む)。訪問の間 Index が持つ。
  private readonly impressedMomentPaths_: Set<string>;
  // この engagement で表示し、まだ view_item_list で送っていない moment。
  private readonly unsentImpressions_: analytics.ListedMoment[];
  // 直前のフレームで円の中心がビューポートの中にあった moment と、途切れずに中にあり始めた時刻
  // (ビューポートから出たフレームで消す)。
  private readonly inViewportSince_: Map<Moment, number>;
  // いまマウスが乗っている moment と、乗せ始めた時刻。外れたら null。
  private currentHover_: { moment: Moment, since: number } | null;
  // 0.5 秒以上乗せた回数と時間の合計。
  private hoverCount_: number;
  private hoverMs_: number;
  constructor(momentList: analytics.MomentItemList, impressedMomentPaths: Set<string>) {
    this.momentList_ = momentList;
    this.impressedMomentPaths_ = impressedMomentPaths;
    this.unsentImpressions_ = [];
    this.inViewportSince_ = new Map();
    this.currentHover_ = null;
    this.hoverCount_ = 0;
    this.hoverMs_ = 0;
  }

  /** 毎フレーム、円の中心がビューポートの中にある moment を渡す。 */
  frame(now: number, momentsInViewport: readonly Moment[]) {
    const since = this.inViewportSince_;
    const current = new Set(momentsInViewport);
    for (const m of Array.from(since.keys())) {
      if (!current.has(m)) {
        since.delete(m);
      }
    }
    for (const m of momentsInViewport) {
      const start = since.get(m);
      if (start === undefined) {
        since.set(m, now);
      } else if (now - start >= kImpressionAfterMs) {
        this.markImpressed_(m);
      }
    }
  }

  /** マウスを乗せた moment が変わった(null は外れた)。 */
  hover(now: number, m: Moment | null) {
    if (this.currentHover_?.moment === m) {
      return;
    }
    this.endHover_(now, false);
    if (m !== null) {
      this.markImpressed_(m);
      this.currentHover_ = { moment: m, since: now };
    }
  }

  /** moment を開いた。乗せていたなら、開かなかった moment_hover は送らない。 */
  open(now: number, m: Moment) {
    this.markImpressed_(m);
    if (this.currentHover_?.moment === m) {
      this.endHover_(now, true);
    }
  }

  /**
   * engagement の終わり。乗せている途中の moment はここで離れたことにし、溜めた分を view_item_list で送る。
   * gear_leave に入れる数を返す。
   */
  end(now: number): { hoverCount: number, hoverMs: number, shownCount: number } {
    this.endHover_(now, false);
    analytics.viewMomentList(this.momentList_, this.unsentImpressions_);
    return {
      hoverCount: this.hoverCount_,
      hoverMs: this.hoverMs_,
      shownCount: this.unsentImpressions_.length,
    };
  }

  private markImpressed_(m: Moment) {
    if (this.impressedMomentPaths_.has(m.path)) {
      return;
    }
    this.impressedMomentPaths_.add(m.path);
    this.unsentImpressions_.push({ path: m.path, title: m.title });
  }

  private endHover_(now: number, opened: boolean) {
    const hover = this.currentHover_;
    if (hover === null) {
      return;
    }
    this.currentHover_ = null;
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
