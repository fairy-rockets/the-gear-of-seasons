import * as analytics from './Analytics';

/**
 * 歯車を回した角度を、入力ごとに足し合わせる。Index が 1 つ持ち、gear_leave に入れる。
 * 画面の向きが変わったときに構図に合わせて回る分(Gear.onSizeChanged)は、操作ではないので数えない。
 * そのため角度の差ではなく、操作を受けたところ(ドラッグ・慣性・ホイール)で add する。
 */
export default class RotationTracker {
  private rotated_: Record<analytics.RotateInput, number>;
  constructor() {
    this.rotated_ = RotationTracker.zero_();
  }

  add(input: analytics.RotateInput, rad: number) {
    this.rotated_[input] += Math.abs(rad);
  }

  /** 足し合わせた角度を返し、数え直す。 */
  take(): Record<analytics.RotateInput, number> {
    const rotated = this.rotated_;
    this.rotated_ = RotationTracker.zero_();
    return rotated;
  }

  private static zero_(): Record<analytics.RotateInput, number> {
    return { mouse: 0, touch: 0, pen: 0, wheel: 0 };
  }
}
