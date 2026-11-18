import * as analytics from './Analytics';
import MomentsTracker from './MomentsTracker';
import RotationTracker from './RotationTracker';

/**
 * 歯車での engagement 1 回分。engagement は、歯車が最上位にあり、タブが前面にある間のこと
 * (GA4 が user_engagement と engagement_time_msec で測るのと同じ区間)。
 * 歯車への 1 回の訪問(歯車に来てから離れるまで)は、タブが隠れるたびに engagement が分かれる。
 *
 * engagement が始まるときに Index が作り、end で view_item_list と gear_leave を送って捨てる。
 */
export default class GearEngagement {
  private readonly startedAt_: number;
  private ended_: boolean;
  readonly moments: MomentsTracker;
  readonly rotation: RotationTracker;
  /**
   * @param impressedMomentPaths この訪問で表示した moment のパス。訪問の間 Index が持ち、
   *   engagement をまたいで同じ moment を二度送らないために使う。
   */
  constructor(now: number, impressedMomentPaths: Set<string>) {
    this.startedAt_ = now;
    this.ended_ = false;
    this.moments = new MomentsTracker(analytics.kGearItemList, impressedMomentPaths);
    this.rotation = new RotationTracker();
  }

  /** この engagement を終え、view_item_list と gear_leave をこの順に送る。2 回目は例外を投げる(二重に送らないため)。 */
  end(now: number, leaveMethod: analytics.GearLeaveMethod) {
    if (this.ended_) {
      throw new Error('GearEngagement.end was called twice');
    }
    this.ended_ = true;
    const counts = this.moments.end(now);
    analytics.gearLeave({
      leaveMethod,
      gearMs: now - this.startedAt_,
      rotationByInput: this.rotation.rotationByInput,
      ...counts,
    });
  }
}
