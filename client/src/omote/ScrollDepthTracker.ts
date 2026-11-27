import * as analytics from './Analytics';

// この位置(%)を越えたら scroll を送る。
const kThresholds = [25, 50, 75, 100];

/**
 * ページの 1 回の表示で、本文をどこまで読んだかを数える。表示のたびに Page が作り直す。
 * 閾値を越えたら、その閾値の scroll を 1 回だけ送る。
 */
export default class ScrollDepthTracker {
  private readonly pageKind_: analytics.PageKind;
  // この表示で届いた、いちばん深い位置(0〜100)。
  private maxPercentScrolled_: number;
  // まだ送っていない閾値のうち、いちばん浅いものの kThresholds での位置。
  private nextThreshold_: number;
  constructor(pageKind: analytics.PageKind) {
    this.pageKind_ = pageKind;
    this.maxPercentScrolled_ = 0;
    this.nextThreshold_ = 0;
  }

  get maxPercentScrolled(): number {
    return this.maxPercentScrolled_;
  }

  /**
   * 本文をスクロールしている要素の、いまの位置を測る。スクロールしない短い本文は、全部見えているので 100%。
   * 画像が読み込まれると本文が伸びるので、そのたびに測り直す。
   */
  measure(scroller: HTMLElement) {
    const height = scroller.scrollHeight;
    if (height <= 0) {
      return;
    }
    // scrollTop は小数になることがあり、scrollHeight と clientHeight は整数に丸められるので、
    // 一番下でも足し算がぴったり一致するとは限らない。1px 以内なら一番下とみなす(MDN の scrollHeight と同じ判定)。
    const atBottom = height - scroller.clientHeight - scroller.scrollTop <= 1;
    const percent = atBottom ? 100 : Math.min(100, Math.round((scroller.scrollTop + scroller.clientHeight) / height * 100));
    if (percent <= this.maxPercentScrolled_) {
      return;
    }
    this.maxPercentScrolled_ = percent;
    while (this.nextThreshold_ < kThresholds.length && kThresholds[this.nextThreshold_] <= percent) {
      analytics.scroll(this.pageKind_, kThresholds[this.nextThreshold_]);
      ++this.nextThreshold_;
    }
  }
}
