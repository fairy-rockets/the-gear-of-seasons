import * as analytics from './Analytics';

/**
 * 歯車の engagement 1 回分で、歯車を回した角度を入力ごとに足し合わせる。GearEngagement が持ち、gear_leave に入れる。
 * 画面の向きが変わったときに構図に合わせて回る分(Gear.onSizeChanged)は、操作ではないので数えない。
 * そのため角度の差ではなく、操作を受けたところ(ドラッグ・慣性・ホイール)で add する。
 */
export default class RotationTracker {
  // 入力ごとの回転の集計(絶対値の合計、ラジアン)。
  private readonly rotationByInput_: Record<analytics.RotateInput, number>;
  constructor() {
    this.rotationByInput_ = { mouse: 0, touch: 0, pen: 0, wheel: 0 };
  }

  add(input: analytics.RotateInput, rad: number) {
    this.rotationByInput_[input] += Math.abs(rad);
  }

  get rotationByInput(): Readonly<Record<analytics.RotateInput, number>> {
    return this.rotationByInput_;
  }
}
