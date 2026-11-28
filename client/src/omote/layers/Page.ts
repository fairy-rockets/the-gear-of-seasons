import World from '../World'
import Layer, { Landing } from '../Layer';
import { mat4 } from 'gl-matrix';
import twemoji from 'twemoji';
import { kEmojiURLBase } from '../../constant';
import * as analytics from '../Analytics';
import PageEngagement from '../PageEngagement';
import ScrollDepthTracker from '../ScrollDepthTracker';
import MediaPlaybackTracker from '../MediaPlaybackTracker';

// 本文の状態: 待っている、表示できた、取得に失敗した。
type BodyState = 'loading' | 'shown' | 'failed';

/**
 * 本文を取ってきて、歯車の上に重ねて見せるページ。moment は MomentPage、それ以外は StaticPage。
 *
 * ページの 1 回の表示(最上位になってから離れるまで)で、page_view を送ってから離れるまでの
 * engagement ごとに page_leave を送り、本文をどこまで読んだか(scroll)を数える。
 */
export default abstract class Page extends Layer {

  private readonly contentWrapper_: HTMLDivElement;
  private readonly content_: HTMLDivElement;
  private readonly closeButton_: HTMLDivElement;
  private readonly closeButtonListener_: () => void;
  private readonly backdropListener_: () => void;
  private readonly visibilityListener_: () => void;
  // 本文を待っているか、表示できたか、取得に失敗したか。
  private bodyState_: BodyState;
  // 本文の題(.title の文字。「:: the gear of seasons」を付ける前)。本文が届くまでと、.title の無い本文では null。
  private contentTitle_: string | null;
  // この表示の page_view を送ったときの nav_via。まだ送っていない間と、最上位でない間は null。
  private pageViewVia_: analytics.NavVia | null;
  // いまの engagement(この表示の page_view を送った後で、タブが前面にある間)。それ以外は null。
  private engagement_: PageEngagement | null;
  // この表示でどこまで読んだか。page_view を送り、本文も表示できたときに作り、離れたら null にする。
  // page_view の前に scroll を送ると、前のページの page_location が付いてしまうので、それまでは測らない。
  private scrollDepth_: ScrollDepthTracker | null;
  // この表示で、本文のメディアをどこまで再生したか。scrollDepth_ と同じ時点で作り、離れたら null にする。
  private mediaPlayback_: MediaPlaybackTracker | null;
  constructor(world: World, path: string, contentPromise: Promise<string>, landing?: Landing) {
    super(world, path, landing);

    this.contentWrapper_ = document.createElement('div');
    this.contentWrapper_.classList.add('content-wrapper');
    this.element.appendChild(this.contentWrapper_);

    this.content_ = document.createElement('div');
    this.content_.classList.add('content');
    this.contentWrapper_.appendChild(this.content_);

    this.closeButton_ = document.createElement('div');
    this.closeButton_.classList.add('close-button');
    this.closeButton_.innerHTML = kCloseButtonSrc;
    this.contentWrapper_.appendChild(this.closeButton_);

    this.closeButtonListener_ = () => {
      this.endEngagement_('close_button');
      this.world.openTop('close_button');
    };
    this.backdropListener_ = () => {
      this.endEngagement_('backdrop');
      this.world.openTop('backdrop');
    };
    this.visibilityListener_ = this.onVisibilityChange_.bind(this);
    this.bodyState_ = 'loading';
    this.contentTitle_ = null;
    this.pageViewVia_ = null;
    this.engagement_ = null;
    this.scrollDepth_ = null;
    this.mediaPlayback_ = null;

    // タッチでも確実に閉じられるよう click を使う(合成 click が発火する)。
    this.closeButton_.addEventListener('click', this.closeButtonListener_, false);
    this.content_.addEventListener('scroll', () => this.measureScroll_(), { passive: true });
    // 画像が読み込まれると本文が伸びるので測り直す(load と error は伝わってこないので、捕捉で受ける)。
    this.content_.addEventListener('load', () => this.measureScroll_(), true);
    this.content_.addEventListener('error', () => this.measureScroll_(), true);
    // メディアのイベントも伝わってこないので、捕捉で受ける。
    this.content_.addEventListener('playing', ev => this.onMediaPlaying_(ev), true);
    this.content_.addEventListener('timeupdate', ev => this.onMediaTimeUpdate_(ev), true);
    this.content_.addEventListener('ended', ev => this.onMediaEnded_(ev), true);

    contentPromise.then(this.onLoad_.bind(this), this.onError_.bind(this));
  }

  /** 本文を取る。HTTP のエラー(404 など)も失敗にして、onError_ に回す。 */
  static fetchBody(url: string): Promise<string> {
    return fetch(url).then(resp => {
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      return resp.text();
    });
  }

  render(time: number, matWorld: mat4) {
  }

  /** 本文の題(「:: the gear of seasons」を付ける前)。本文が届くまでと、.title の無い本文では null。 */
  protected get contentTitle(): string | null {
    return this.contentTitle_;
  }

  /**
   * サーバが SSR した <title> と同じ形にすること(server/src/lib/meta.ts の pageTitle)。
   * 本文の題が分かるまでは、landing なら SSR の題、そうでなければサイト名(Layer が決める)。
   */
  // TODO: 同じ組み立てをサーバとクライアントで二重に持っている。増えてきたら
  // protocol.ts のように共有する場所へ移すか考える。
  override get title(): string {
    return this.contentTitle_ === null ? this.title_ : `${this.contentTitle_} :: the gear of seasons`;
  }

  // landing なら SSR の題がもう正しい。そうでなければ本文の .title から決まる。
  override get titleKnown(): boolean {
    return this.landing_ || this.bodyState_ !== 'loading';
  }

  /**
   * この表示を見せ始めた。page_view を送ってあり、本文も表示できたときに、表示ごとに 1 回呼ぶ
   * (どちらが先でも、後の方で呼ぶ)。この後で、深さを測り始める(page_view → これが送るもの → scroll の順)。
   */
  protected abstract onViewed(via: analytics.NavVia): void;

  onLoad_(body: string) {
    // 文字列に対して parse すると、属性値(title="カエル🐸…" など)の絵文字まで
    // <img> に置換されてタグが壊れる。DOM に対して parse すればテキストノードだけが対象になる。
    this.content_.innerHTML = body;

    // twemoji.parse より前に読む。後だと絵文字が <img> になり、textContent から消える。
    const titles = this.content_.getElementsByClassName("title");
    if(titles.length > 0) {
      this.contentTitle_ = titles[0].textContent ?? "";
    }

    twemoji.parse(this.content_, { base: kEmojiURLBase });

    const contents = this.content_.getElementsByTagName('script');
    for(let i = 0; i < contents.length; ++i) {
      const src = contents[i];
      const dst = document.createElement('script');
      dst.textContent = src.textContent;
      dst.src = src.src;
      dst.async = src.async;
      const p = src.parentNode!;
      p.insertBefore(dst, src);
      p.removeChild(src);
    }

    this.setupFooter_();
    this.bodyState_ = 'shown';
    // 最上位なら、ここで page_view が送られ、続けて onPageViewSent で見せ始める。
    this.world.notifyLoaded(this);
    // landing では page_view が本文より先に送られているので、ここで見せ始める。
    if(this.pageViewVia_ !== null && this.scrollDepth_ === null) {
      this.startViewing_(this.pageViewVia_);
    }
  }

  // moment 本文の末尾に付く .moment-footer（無ければ何もしない。about-us 等はフッター無し）
  private setupFooter_() {
    const gearLink = this.content_.querySelector<HTMLAnchorElement>('.moment-footer-gear');
    if(gearLink) {
      gearLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        this.endEngagement_('footer_gear');
        this.world.openTop('footer_gear');
      });
    }

    const prevLink = this.content_.querySelector<HTMLAnchorElement>('a.moment-footer-prev');
    if(prevLink) {
      prevLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        this.endEngagement_('footer_prev');
        this.world.openLayer(prevLink.getAttribute('href')!, 'footer_prev');
      });
    }

    const nextLink = this.content_.querySelector<HTMLAnchorElement>('a.moment-footer-next');
    if(nextLink) {
      nextLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        this.endEngagement_('footer_next');
        this.world.openLayer(nextLink.getAttribute('href')!, 'footer_next');
      });
    }

    const links = this.content_.querySelector<HTMLElement>('.moment-footer-links');
    if(links) {
      for(const a of Array.from(links.querySelectorAll<HTMLAnchorElement>('a'))) {
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          this.endEngagement_('footer_link');
          this.world.openLayer(a.getAttribute('href')!, 'footer_link');
        });
      }
    }
  }

  onError_(err: any) {
    this.content_.innerHTML = `<h1>エラー！</h1>Error:<strong>${err}</strong>`;
    analytics.exception(`page_load_failed: ${this.path}`, false);
    // 見せ始めない(onViewed を呼ばず、深さも測らない)。page_leave は送る。
    this.bodyState_ = 'failed';
    this.world.notifyLoaded(this);
  }

  // engagement を始め、本文を表示できていれば見せ始める(本文がまだなら、届いたとき(onLoad_)に)。
  override onPageViewSent(via: analytics.NavVia) {
    this.pageViewVia_ = via;
    if(document.visibilityState !== 'hidden' && this.engagement_ === null) {
      this.startEngagement_();
    }
    if(this.bodyState_ === 'shown') {
      this.startViewing_(via);
    }
  }

  private startViewing_(via: analytics.NavVia) {
    this.onViewed(via);
    this.scrollDepth_ = new ScrollDepthTracker();
    this.mediaPlayback_ = new MediaPlaybackTracker();
    this.measureScroll_();
  }

  onAttached() {
    this.world.canvas.addEventListener('mouseup', this.backdropListener_, false);
    document.addEventListener('visibilitychange', this.visibilityListener_, false);
  }

  onDetached() {
    // 閉じる・背景・フッターのリンクで離れるときは、もう engagement を終えている。残るのは戻る・進む。
    this.endEngagement_('history');
    // 次の表示では、page_view からまた数える。
    this.pageViewVia_ = null;
    this.scrollDepth_ = null;
    this.mediaPlayback_ = null;
    this.world.canvas.removeEventListener('mouseup', this.backdropListener_, false);
    document.removeEventListener('visibilitychange', this.visibilityListener_, false);
  }

  // タブが隠れたら、いまの engagement を終えて送る。戻ってきたら、この表示の page_view の後なら次の engagement を始める。
  private onVisibilityChange_() {
    if(document.visibilityState === 'hidden') {
      this.endEngagement_('hidden');
    } else if(this.engagement_ === null && this.pageViewVia_ !== null) {
      this.startEngagement_();
    }
  }

  private startEngagement_() {
    this.engagement_ = new PageEngagement(performance.now());
  }

  /** いまの engagement を終えて送る(page_leave)。engagement が無ければ何もしない。 */
  private endEngagement_(leaveMethod: analytics.PageLeaveMethod) {
    const engagement = this.engagement_;
    if(engagement === null) {
      return;
    }
    this.engagement_ = null;
    engagement.end(performance.now(), leaveMethod, this.scrollDepth_?.maxPercentScrolled ?? 0);
  }

  // 見せ始めた後(scrollDepth_ がある間)だけ測る。
  // 本文の画像がすべて読み込まれる(か失敗する)までも測らない。読み込む前の <img> は高さが 0 で
  // (CSS で width・height を auto にしている)、長い本文でも短く見え、すぐに 100% になってしまう。
  private measureScroll_() {
    if(this.scrollDepth_ === null) {
      return;
    }
    for(const img of Array.from(this.content_.getElementsByTagName('img'))) {
      if(!img.complete) {
        return;
      }
    }
    this.scrollDepth_.measure(this.content_);
  }

  private onMediaPlaying_(ev: Event) {
    const media = playedMediaOf(ev.target);
    if(media !== null) {
      this.mediaPlayback_?.started(media);
    }
  }

  private onMediaTimeUpdate_(ev: Event) {
    const media = playedMediaOf(ev.target);
    const el = ev.target as HTMLMediaElement;
    // 長さが分かる(metadata を読む)までは測らない。
    if(media === null || !Number.isFinite(el.duration) || el.duration <= 0) {
      return;
    }
    this.mediaPlayback_?.reached(media, el.currentTime / el.duration);
    // loop の動画は終わりで先頭に戻り、ended が来ない。終わりから kLoopEndSec 以内に入ったら、最後まで行ったことにする
    // (timeupdate は再生中に 0.25 秒ほどごとに来るので、この幅なら取りこぼさない)。
    if(el.loop && el.duration - el.currentTime <= kLoopEndSec) {
      this.mediaPlayback_?.ended(media);
    }
  }

  private onMediaEnded_(ev: Event) {
    const media = playedMediaOf(ev.target);
    if(media !== null) {
      this.mediaPlayback_?.ended(media);
    }
  }

  /** @override */
  destroy() {
  }
}

// loop の動画を、終わりからこの秒数以内に入ったら最後まで行ったことにする。
const kLoopEndSec = 0.5;

// 本文の <video>・<audio>(サーバが data-entity と data-type を付ける)なら、その PlayedMedia。
function playedMediaOf(target: EventTarget | null): analytics.PlayedMedia | null {
  if(!(target instanceof HTMLMediaElement)) {
    return null;
  }
  const entity = target.dataset['entity'];
  const type = target.dataset['type'];
  if(entity === undefined || (type !== 'video' && type !== 'audio')) {
    return null;
  }
  return { entity, mediaType: type, platform: 'internal' };
}

const kHTMLSrc = `
<div class="content">
</div>
`;

// viewBox 基準にして、ボタンの大きさは .close-button の width/height で決める。
const kCloseButtonSrc = `
<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
  <rect
      x="0" y="0"
      width="100" height="100"
      rx="20" ry="20"
      style="fill:white;fill-opacity:0.7;" />
  <line stroke-linecap="round"
          x1="25" y1="25" x2="75" y2="75"
          stroke="rgba(0, 0, 0, 0.5)" stroke-width="14"/>
  <line stroke-linecap="round"
          x1="25" y1="75" x2="75" y2="25"
          stroke="rgba(0, 0, 0, 0.5)" stroke-width="14"/>
</svg>
`;
