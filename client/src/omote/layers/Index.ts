import World from '../World'
import Layer, { Landing } from '../Layer';
import Moments from '../actors/Moments';
import Moment from '../actors/Moment';
import { mat4, vec4 } from 'gl-matrix';
import Page from './Page';
import twemoji from 'twemoji';
import * as protocol from '../../protocol';
import { kEmojiURLBase } from '../../constant';
import * as analytics from '../Analytics';
import GearEngagement from '../GearEngagement';

// タップとドラッグを見分ける移動量のしきい値(px)。これ以下ならタップ扱い。
const kTapThresholdPx = 8;
// フリック慣性の摩擦。1ミリ秒ごとに角速度へ掛ける減衰率(値が小さいほど早く止まる)。
const kInertiaFrictionPerMs = 0.995;
// これ未満の角速度(rad/ms)は止まったとみなす。
const kInertiaMinVelocity = 1e-5;
// 指を離す直前がこの時間(ms)より前の動きなら、フリックとみなさない(押しっぱなしからの解放)。
const kFlickMaxIdleMs = 60;

export default class Index extends Layer {
  private readonly wheelEventListener_: (ev: WheelEvent) => void;
  private readonly pointerDownListener_: (ev: PointerEvent) => void;
  private readonly pointerMoveListener_: (ev: PointerEvent) => void;
  private readonly pointerUpListener_: (ev: PointerEvent) => void;
  private readonly pointerCancelListener_: (ev: PointerEvent) => void;
  private readonly moments_: Moments;
  // ヒット判定に使うポインタ位置(正規化 -1..1)。pointer イベントから更新する。
  private pointerX_: number;
  private pointerY_: number;
  private selected_: Moment | null;
  private readonly tooltip_: HTMLDivElement;
  private readonly tooltipTitle_: HTMLDivElement;
  private readonly tooltipDate_: HTMLDivElement;
  private readonly aboutUsLink_: HTMLElement;
  private loaded_: boolean;
  // gear_ready の起点(このレイヤを作った時刻)と、もう送ったか(送らないと決めたときも true)。
  private readonly createdAt_: number;
  private readyReported_: boolean;
  // いまの engagement(歯車が最上位で、タブが前面にある間)。表示した・乗せた moment と回した角度を数え、
  // 終わるときに view_item_list と gear_leave を送る。タブが隠れている間と、歯車にいない間は null。
  private engagement_: GearEngagement | null;
  // この訪問(歯車に来てから離れるまで)で表示した moment のパス。engagement をまたいで同じ moment を
  // 二度送らないために使い、歯車に来るたびに空にする。
  private readonly impressedMomentPaths_: Set<string>;
  private readonly visibilityListener_: () => void;
  // ポインタ操作の状態
  private pointerId_: number | null;
  private pointerLastX_: number;
  private pointerLastY_: number;
  private pointerDownX_: number;
  private pointerDownY_: number;
  // 最後に受けたポインタの種類。ホバー(ツールチップ)を出すのは mouse のときだけ。
  private pointerType_: analytics.PointerInput;
  // いまの慣性を起こしたドラッグの入力。慣性で回った分はその入力に数える。
  private inertiaInput_: analytics.PointerInput;
  private pendingTapOpen_: boolean;
  private readonly centerTmp_: vec4;
  // フリック慣性の状態
  private angularVelocity_: number; // rad/ms
  private lastMoveTime_: number;    // 直近の pointermove の timeStamp(ms)
  private lastFrameTime_: number;   // 直近フレームの時刻(ms)。慣性減衰の dt 算出用
  constructor(world: World, landing?: Landing) {
    super(world, '/', landing);
    this.wheelEventListener_ = this.onWheelEvent_.bind(this);
    this.pointerDownListener_ = this.onPointerDown_.bind(this);
    this.pointerMoveListener_ = this.onPointerMove_.bind(this);
    this.pointerUpListener_ = this.onPointerUp_.bind(this);
    this.pointerCancelListener_ = this.onPointerCancel_.bind(this);
    this.moments_ = new Moments(world);
    this.pointerX_ = NaN;
    this.pointerY_ = NaN;
    this.pointerId_ = null;
    this.pointerLastX_ = NaN;
    this.pointerLastY_ = NaN;
    this.pointerDownX_ = NaN;
    this.pointerDownY_ = NaN;
    this.pointerType_ = 'mouse';
    this.inertiaInput_ = 'mouse';
    this.pendingTapOpen_ = false;
    this.centerTmp_ = vec4.create();
    this.angularVelocity_ = 0;
    this.lastMoveTime_ = 0;
    this.lastFrameTime_ = 0;

    this.element.innerHTML = kHTMLSrc;
    this.selected_ = null;

    this.tooltip_ = document.createElement('div');
    this.tooltip_.classList.add('tooltip', 'hidden');
    this.element_.appendChild(this.tooltip_);

    this.tooltipTitle_ = document.createElement('div');
    this.tooltipTitle_.classList.add('moment-title');
    this.tooltip_.appendChild(this.tooltipTitle_);

    this.tooltipDate_ = document.createElement('div');
    this.tooltipDate_.classList.add('date');
    this.tooltip_.appendChild(this.tooltipDate_);

    this.aboutUsLink_ = this.element_.querySelector<HTMLElement>('#about-us-link')!;
    this.aboutUsLink_.addEventListener('click', (e) => {
      e.preventDefault();
      this.leave_('header');
      world.openLayer('/about-us/', 'header');
    });
    this.element_.querySelector<HTMLElement>('#pickup-link')!.addEventListener('click', (e) => {
      e.preventDefault();
      this.leave_('header');
      world.openLayer('/pickup/', 'header');
    });
    this.element_.querySelector<HTMLElement>('#shop-link')!.addEventListener('click', (e) => {
      e.preventDefault();
      this.leave_('header');
      world.openLayer('/shop/', 'header');
    });

    this.loaded_ = false;
    this.createdAt_ = performance.now();
    this.readyReported_ = false;
    this.engagement_ = null;
    this.impressedMomentPaths_ = new Set();
    this.visibilityListener_ = this.onVisibilityChange_.bind(this);
  }

  // 題はいつもサイト名なので、本文を待たない。
  override get titleKnown(): boolean {
    return true;
  }

  render(time: number, matWorld: mat4) {
    this.applyInertia_(time);
    const m = this.moments_.render(time, matWorld, this.pointerX_, this.pointerY_);
    this.engagement_?.moments.frame(performance.now(), this.moments_.momentsInViewport);
    if(!this.readyReported_ && this.moments_.drawnCount > 0) {
      this.readyReported_ = true;
      analytics.gearReady(performance.now() - this.createdAt_);
    }
    if(m !== this.selected_) {
      this.selected_ = m;
      this.onSelectionChanged_(m);
    }
    // タップ時はこのフレームのヒット判定結果(selected_)を使って moment を開く。
    if(this.pendingTapOpen_) {
      this.pendingTapOpen_ = false;
      if(this.selected_) {
        this.openMoment_(this.selected_);
      }
      if(this.pointerType_ !== 'mouse') {
        // タッチ操作では選択を残さない(ツールチップを出さない)。
        this.pointerX_ = NaN;
        this.pointerY_ = NaN;
      }
    }
  }

  // フリックの慣性: ドラッグ解放後に残った角速度で歯車を回し続け、摩擦で減衰させる。
  private applyInertia_(time: number) {
    const prev = this.lastFrameTime_;
    this.lastFrameTime_ = time;
    // ドラッグ中・速度なし・不正な dt のときは何もしない。
    if(this.pointerId_ !== null || this.angularVelocity_ === 0 || prev === 0) {
      return;
    }
    let dt = time - prev;
    if(dt <= 0) {
      return;
    }
    if(dt > 100) {
      dt = 100; // タブ復帰などで巨大な dt が来ても飛ばないよう上限を設ける。
    }
    this.world.gear.angle += this.angularVelocity_ * dt;
    this.engagement_?.rotation.add(this.inertiaInput_, this.angularVelocity_ * dt);
    this.angularVelocity_ *= Math.pow(kInertiaFrictionPerMs, dt);
    if(Math.abs(this.angularVelocity_) < kInertiaMinVelocity) {
      this.angularVelocity_ = 0;
    }
    if(this.selected_) {
      this.fixTooltipPosition_();
    }
  }

  private onSelectionChanged_(m: Moment | null) {
    this.engagement_?.moments.hover(performance.now(), this.pointerType_ === 'mouse' ? m : null);
    const tooltip = this.tooltip_;
    // タッチ/ペン入力ではホバー相当のツールチップは出さない(即オープンに割り切る)。
    if(m === null || this.pointerType_ !== 'mouse') {
      tooltip.classList.add('hidden');
    } else {
      tooltip.classList.remove('hidden');

      // title
      this.tooltipTitle_.innerHTML = twemoji.parse(m.title, { base: kEmojiURLBase });
      this.tooltipDate_.innerHTML = m.date;
      this.fixTooltipPosition_();
    }
  }

  private fixTooltipPosition_() {
    const tooltip = this.tooltip_;
    const m = this.selected_;
    if(m == null) {
      return;
    }
    if((m.screenBottomY + m.screenTopY) / 2 / this.world_.canvas.height >= 0.5) {
      tooltip.style.top = (m.screenTopY - tooltip.clientHeight)+'px';
      tooltip.style.left = (m.screenTopX - tooltip.clientWidth/2)+'px';
    }else{
      tooltip.style.top = m.screenBottomY+'px';
      tooltip.style.left = (m.screenTopX - tooltip.clientWidth/2)+'px';
    }
  }

  override onAttached() {
    this.impressedMomentPaths_.clear();
    if(document.visibilityState !== 'hidden') {
      this.startEngagement_();
    }
    document.addEventListener('visibilitychange', this.visibilityListener_, false);
    this.world.cursor = false;
    this.world.canvas.addEventListener('wheel', this.wheelEventListener_, false);
    this.world.canvas.addEventListener('pointerdown', this.pointerDownListener_, false);
    this.world.canvas.addEventListener('pointermove', this.pointerMoveListener_, false);
    this.world.canvas.addEventListener('pointerup', this.pointerUpListener_, false);
    this.world.canvas.addEventListener('pointercancel', this.pointerCancelListener_, false);
    if(!this.loaded_) {
      // 300 件はランダムに引く母数。少ないと季節ごとの偏りで、時期によっては画面が
      // モーメントで埋まりきらないことがある。減らすなら各季節での見え方を確かめること。
      this.fetch(300);
    }
    this.pointerX_ = NaN;
    this.pointerY_ = NaN;
    this.pointerId_ = null;
    this.pointerType_ = 'mouse';
    this.pendingTapOpen_ = false;
    this.angularVelocity_ = 0;
    this.lastMoveTime_ = 0;
    this.lastFrameTime_ = 0;
  }

  override onDetached() {
    // 見出しや moment から離れるときは、もう leave_ を呼んでいる。残るのは戻る・進む。
    this.leave_('history');
    document.removeEventListener('visibilitychange', this.visibilityListener_, false);
    // 歯車が出る前に別のページへ移ったら送らない。戻るまでの時間が load_ms に入ってしまう。
    this.readyReported_ = true;
    this.pointerX_ = NaN;
    this.pointerY_ = NaN;
    this.pointerId_ = null;
    this.pointerType_ = 'mouse';
    this.pendingTapOpen_ = false;
    this.angularVelocity_ = 0;
    this.lastMoveTime_ = 0;
    this.lastFrameTime_ = 0;
    this.world.cursor = false;
    this.world.canvas.removeEventListener('wheel', this.wheelEventListener_, false);
    this.world.canvas.removeEventListener('pointerdown', this.pointerDownListener_, false);
    this.world.canvas.removeEventListener('pointermove', this.pointerMoveListener_, false);
    this.world.canvas.removeEventListener('pointerup', this.pointerUpListener_, false);
    this.world.canvas.removeEventListener('pointercancel', this.pointerCancelListener_, false);
  }

  // タブが隠れたら、いまの engagement を終えて送る。戻ってきたら、次の engagement を始める。
  private onVisibilityChange_() {
    if(document.visibilityState === 'hidden') {
      this.leave_('hidden');
    } else if(this.engagement_ === null) {
      this.startEngagement_();
    }
  }

  private startEngagement_() {
    this.engagement_ = new GearEngagement(performance.now(), this.impressedMomentPaths_);
  }

  /** いまの engagement を終えて送る(view_item_list と gear_leave)。engagement が無ければ何もしない。 */
  private leave_(leaveMethod: analytics.GearLeaveMethod) {
    const engagement = this.engagement_;
    if(engagement === null) {
      return;
    }
    this.engagement_ = null;
    engagement.end(performance.now(), leaveMethod);
  }

  private openMoment_(m: Moment) {
    this.engagement_?.moments.open(performance.now(), m);
    this.leave_('select');
    analytics.selectMoment(analytics.kGearItemList, m, this.pointerType_);
    const content = Page.fetchBody(m.bodyURL);
    this.world.pushLayer(new Page(this.world, m.path, content), 'gear');
  }

  // 歯車の中心(モデル原点)を現在のスクリーン座標(px)に投影して返す。
  // 回転しても原点は不変なので angle には依存しない。
  //
  // 回転はこの投影中心まわりのスクリーン角(px)で測って angle にそのまま加算している。
  // これが成り立つのは歯車の回転軸(モデルZ)が視線(-Z)と平行=回転面が画面と正対して
  // いるから(Gear.onSizeChanged は matModel/matLoc に回転を入れていない)。正対面の
  // Z 回転は投影しても投影中心まわりの純粋な回転になり、投影の x/aspect と viewport の
  // ×width(=aspect·height)が相殺するので px 空間の角度=モデル回転角(符号のみ)になる。
  // 前提が崩れるのは歯車を傾けた場合で、その時は指をモデル平面へ unproject して測る必要がある。
  private gearCenterScreen_(): [number, number] {
    const v = this.centerTmp_;
    vec4.set(v, 0, 0, 0, 1);
    vec4.transformMat4(v, v, this.world.gear.matrix); // matLocModel
    vec4.transformMat4(v, v, this.world.matWorld);     // proj * eye
    const canvas = this.world.canvas;
    const cx = (v[0] / v[3] + 1) * canvas.width / 2;
    const cy = (1 - v[1] / v[3]) * canvas.height / 2;
    return [cx, cy];
  }

  // 画面座標をヒット判定用の正規化座標(-1..1)へ変換して pointerX_/pointerY_ に入れる。
  private updateHitPosition_(clientX: number, clientY: number) {
    const canvas = this.world.canvas;
    const hw = canvas.width/2;
    const hh = canvas.height/2;
    this.pointerX_ = (clientX - hw) / hw;
    this.pointerY_ = -(clientY - hh) / hh;
  }

  private onPointerDown_(ev: PointerEvent) {
    // 既に別のポインタを掴んでいる場合(マルチタッチの2本目など)は無視する。
    if(this.pointerId_ !== null) {
      return;
    }
    ev.preventDefault();
    this.pointerType_ = analytics.pointerInputOf(ev.pointerType);
    this.pointerId_ = ev.pointerId;
    this.pointerDownX_ = ev.clientX;
    this.pointerDownY_ = ev.clientY;
    this.pointerLastX_ = ev.clientX;
    this.pointerLastY_ = ev.clientY;
    // 掴んだら慣性を止める(進行中のフリックをその場で押さえられる)。
    this.angularVelocity_ = 0;
    this.lastMoveTime_ = ev.timeStamp;
    this.world.canvas.setPointerCapture(ev.pointerId);
  }

  private onPointerMove_(ev: PointerEvent) {
    this.pointerType_ = analytics.pointerInputOf(ev.pointerType);
    if(this.pointerId_ === ev.pointerId) {
      // ドラッグ中: 歯車中心まわりの角度変化ぶんだけ回す。
      // 円周方向の動きは指に追従し、直径方向(中心へ/から)の動きは無視される。
      ev.preventDefault();
      const [cx, cy] = this.gearCenterScreen_();
      // y上向きの数学座標にして角度を取る(反時計回りが正)。
      const a1 = Math.atan2(cy - this.pointerLastY_, this.pointerLastX_ - cx);
      const a2 = Math.atan2(cy - ev.clientY, ev.clientX - cx);
      let dA = a2 - a1;
      if(dA > Math.PI) { dA -= 2 * Math.PI; }
      else if(dA < -Math.PI) { dA += 2 * Math.PI; }
      this.pointerLastX_ = ev.clientX;
      this.pointerLastY_ = ev.clientY;
      // +angle は画面上で反時計回り。指の回した向きにそのまま追従させる。
      this.world.gear.angle += dA;
      this.engagement_?.rotation.add(this.pointerType_, dA);
      // フリック慣性用に直近の角速度(rad/ms)を記録。ノイズを抑えるため軽くならす。
      const dt = ev.timeStamp - this.lastMoveTime_;
      this.lastMoveTime_ = ev.timeStamp;
      if(dt > 0) {
        this.angularVelocity_ = this.angularVelocity_ * 0.2 + (dA / dt) * 0.8;
      }
      if(this.selected_) {
        this.fixTooltipPosition_();
      }
    } else if(ev.pointerType === 'mouse') {
      // マウスのホバー(ボタン非押下)は従来どおり選択+ツールチップを出す。
      ev.preventDefault();
      this.updateHitPosition_(ev.clientX, ev.clientY);
    }
  }

  private onPointerUp_(ev: PointerEvent) {
    if(this.pointerId_ !== ev.pointerId) {
      return;
    }
    ev.preventDefault();
    // 慣性と select_item の input は、離したポインタの種類にする(途中で別のポインタが動いていても)。
    this.pointerType_ = analytics.pointerInputOf(ev.pointerType);
    this.world.canvas.releasePointerCapture(ev.pointerId);
    this.pointerId_ = null;
    const dist = Math.hypot(ev.clientX - this.pointerDownX_, ev.clientY - this.pointerDownY_);
    if(dist <= kTapThresholdPx) {
      // タップ/クリック: 離した点でヒット判定させ、次フレームで moment を開く。慣性は乗せない。
      this.angularVelocity_ = 0;
      this.updateHitPosition_(ev.clientX, ev.clientY);
      this.pendingTapOpen_ = true;
    } else {
      // ドラッグ解放: 離す直前まで動いていればフリック慣性を残す。
      // 止めてから離した(idle が長い)場合は慣性を乗せない。
      if(ev.timeStamp - this.lastMoveTime_ > kFlickMaxIdleMs) {
        this.angularVelocity_ = 0;
      }
      this.inertiaInput_ = this.pointerType_;  // 掴んでいたポインタ(onPointerUp_ の先頭で更新)
      if(this.pointerType_ !== 'mouse') {
        // タッチのドラッグ後は選択を残さない。
        this.pointerX_ = NaN;
        this.pointerY_ = NaN;
      }
    }
  }

  private onPointerCancel_(ev: PointerEvent) {
    if(this.pointerId_ !== ev.pointerId) {
      return;
    }
    this.pointerId_ = null;
    this.pendingTapOpen_ = false;
    this.angularVelocity_ = 0;
    if(this.pointerType_ !== 'mouse') {
      this.pointerX_ = NaN;
      this.pointerY_ = NaN;
    }
  }

  private onWheelEvent_(event: WheelEvent) {
    event.preventDefault();
    const world = this.world;
    let dx = event.deltaX;
    let dy = event.deltaY;
    switch(event.deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      dx *= 30;
      dy *= 30;
    break;
    case WheelEvent.DOM_DELTA_PIXEL:
      break;
    case WheelEvent.DOM_DELTA_PAGE:
      dx *= 300;
      dy *= 300;
      break;
    default:
      throw new Error("Unknown delta mode: "+event.deltaMode);
    }
    
    const dA = (dy - dx) * Math.PI / (360 * 10);
    world.gear.angle += dA;
    this.engagement_?.rotation.add('wheel', dA);
    if(this.selected_) {
      this.fixTooltipPosition_();
    }
  }

  private onLoadMoments_(moments: protocol.Moment.Search.Response[]) {
    const world = this.world;
    const models: Moment[] = [];
    for(let m of moments) {
      const model = new Moment(world, m.angle, m.date, m.title, m.path, m.imageURL, m.bodyURL);
      model.relocation(models);
      models.push(model);
    }
    this.moments_.models = models;
    this.loaded_ = true;
  }

  fetch(size: number) {
    fetch(`/moments/random?size=${size}`)
      .then(resp => resp.json())
      .then(this.onLoadMoments_.bind(this))
      .catch((err) => {
        console.error('Failed to load moments: ', err);
        analytics.exception('moments_load_failed', false);
      });
  }

  destroy() {
    this.moments_.destroy();
  }
}

const kHTMLSrc = `
<div class="header">
  <div class="title">
  <h1>妖精⊸ロケット</h1>
  季節の歯車
  </div>
  <div class="description">
  <a href="/about-us/" id="about-us-link">About us</a>
  </div>
  <div class="description">
  <a href="/pickup/" id="pickup-link">えらんだ絵</a>
  </div>
  <div class="description">
  <a href="/shop/" id="shop-link">お店</a>
  </div>
</div>
`;
