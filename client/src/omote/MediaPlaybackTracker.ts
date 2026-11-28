import * as analytics from './Analytics';

// この位置(%)を越えたら media_progress を送る。100 は media_complete で送る。
const kThresholds = [25, 50, 75];

// メディア 1 つの、この表示での送り具合。
type Playback = {
  // まだ送っていない閾値のうち、いちばん浅いものの kThresholds での添字(送った閾値の数と同じ)。
  nextThresholdIndex: number;
  completed: boolean;
};

/**
 * ページの 1 回の表示で、本文のメディアをどこまで再生したかを数える。表示のたびに Page が作り直す。
 * engagement(タブが隠れるたびに分かれる)はまたぐ。
 *
 * どこから来た再生か(<video>・<audio>、YouTube のプレイヤー)は知らず、始まった・ここまで進んだ・
 * 最後まで行った、の 3 つだけを受け取る。それぞれ、メディア(entity)ごとに 1 回だけ送る。
 * 同じ entity が本文に 2 回出ても、1 つのメディアとして数える。
 */
export default class MediaPlaybackTracker {
  // 再生が始まったメディア(entity の id から)。始まる前のメディアの進み・終わりは送らない
  // (止めたまま位置を動かしただけのものは、再生していない)。
  private readonly playbacks_: Map<string, Playback>;
  constructor() {
    this.playbacks_ = new Map();
  }

  /** 再生が始まった。そのメディアで初めてなら media_start を送る。 */
  started(media: analytics.PlayedMedia) {
    if (this.playbacks_.has(media.entity)) {
      return;
    }
    this.playbacks_.set(media.entity, { nextThresholdIndex: 0, completed: false });
    analytics.mediaStart(media);
  }

  /** 再生位置が、長さの fraction(0〜1)まで来た。越えた閾値の media_progress を、まとめて送る。 */
  reached(media: analytics.PlayedMedia, fraction: number) {
    const playback = this.playbacks_.get(media.entity);
    if (playback === undefined) {
      return;
    }
    const percent = fraction * 100;
    while (playback.nextThresholdIndex < kThresholds.length && kThresholds[playback.nextThresholdIndex] <= percent) {
      analytics.mediaProgress(media, kThresholds[playback.nextThresholdIndex]);
      ++playback.nextThresholdIndex;
    }
  }

  /** 最後まで行った。そのメディアで初めてなら、残りの media_progress の後に media_complete を送る。 */
  ended(media: analytics.PlayedMedia) {
    const playback = this.playbacks_.get(media.entity);
    if (playback === undefined || playback.completed) {
      return;
    }
    this.reached(media, 1);
    playback.completed = true;
    analytics.mediaComplete(media);
  }
}
