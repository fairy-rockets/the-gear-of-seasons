import * as analytics from './Analytics';

/**
 * ページでの engagement 1 回分。engagement は、その表示の page_view を送った後で、そのページが最上位にあり、
 * タブが前面にある間のこと。ページの 1 回の表示は、タブが隠れるたびに engagement が分かれる。
 * page_view の前は数えない(その間に送ると、下のページの page_location が付くため)。
 *
 * engagement が始まるときに Page が作り、end で page_leave を送って捨てる。
 */
export default class PageEngagement {
  private readonly startedAt_: number;
  private ended_: boolean;
  constructor(now: number) {
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
      leaveMethod,
      pageMs: now - this.startedAt_,
      maxPercentScrolled,
    });
  }
}
