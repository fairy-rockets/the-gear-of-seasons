import * as analytics from './Analytics';

/**
 * ページでの engagement 1 回分。engagement は、そのページが最上位にあり、タブが前面にある間のこと
 * (GearEngagement と同じ区切り)。ページの 1 回の表示は、タブが隠れるたびに engagement が分かれる。
 *
 * engagement が始まるときに Page が作り、end で page_leave を送って捨てる。
 */
export default class PageEngagement {
  private readonly pageKind_: analytics.PageKind;
  private readonly startedAt_: number;
  private ended_: boolean;
  constructor(pageKind: analytics.PageKind, now: number) {
    this.pageKind_ = pageKind;
    this.startedAt_ = now;
    this.ended_ = false;
  }

  /** この engagement を終え、page_leave を送る。2 回目は例外を投げる(二重に送らないため)。 */
  end(now: number, leaveMethod: analytics.PageLeaveMethod, maxPercentScrolled: number) {
    if (this.ended_) {
      throw new Error('PageEngagement.end was called twice');
    }
    this.ended_ = true;
    analytics.pageLeave({
      pageKind: this.pageKind_,
      leaveMethod,
      pageMs: now - this.startedAt_,
      maxPercentScrolled,
    });
  }
}
