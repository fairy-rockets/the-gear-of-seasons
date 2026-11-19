import World from '../World'
import Layer, { Landing } from '../Layer';
import { mat4 } from 'gl-matrix';
import twemoji from 'twemoji';
import { kEmojiURLBase } from '../../constant';
import * as analytics from '../Analytics';
import PageEngagement from '../PageEngagement';
import ScrollDepthTracker from '../ScrollDepthTracker';

export default class Page extends Layer {

  private readonly kind_: analytics.PageKind;
  private readonly contentWrapper_: HTMLDivElement;
  private readonly content_: HTMLDivElement;
  private readonly closeButton_: HTMLDivElement;
  private readonly closeButtonListener_: () => void;
  private readonly backdropListener_: () => void;
  private readonly visibilityListener_: () => void;
  // 本文が届いたか(取得に失敗したときも含む)。
  private loaded_: boolean;
  // 本文を表示できたか(取得に失敗したときは false のまま)。スクロールの深さは、表示できた本文だけで測る。
  private bodyShown_: boolean;
  // moment の題(本文の .title。「:: the gear of seasons」を付ける前)。本文が届くまでと、moment 以外は null。
  private momentTitle_: string | null;
  // page_view は送ったが、本文がまだ届かず view_item を送れていないときの nav_via(landing のとき)。
  private viewItemPendingVia_: analytics.NavVia | null;
  // いまの engagement(最上位で、タブが前面にある間)。タブが隠れている間と、最上位でない間は null。
  private engagement_: PageEngagement | null;
  // この表示でどこまで読んだか。表示の page_view を送ったときに作り、離れたら null にする。
  // page_view の前に scroll を送ると、前のページの page_location が付いてしまうので、それまでは測らない。
  private scrollDepth_: ScrollDepthTracker | null;
  constructor(world: World, path: string, kind: analytics.PageKind, contentPromise: Promise<string>, landing?: Landing) {
    super(world, path, landing);
    this.kind_ = kind;

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
    this.loaded_ = false;
    this.bodyShown_ = false;
    this.momentTitle_ = null;
    this.viewItemPendingVia_ = null;
    this.engagement_ = null;
    this.scrollDepth_ = null;

    // タッチでも確実に閉じられるよう click を使う(合成 click が発火する)。
    this.closeButton_.addEventListener('click', this.closeButtonListener_, false);
    this.content_.addEventListener('scroll', () => this.measureScroll_(), { passive: true });
    // 画像が読み込まれると本文が伸びるので測り直す(load と error は伝わってこないので、捕捉で受ける)。
    this.content_.addEventListener('load', () => this.measureScroll_(), true);
    this.content_.addEventListener('error', () => this.measureScroll_(), true);

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

  onLoad_(body: string) {
    // 文字列に対して parse すると、属性値(title="カエル🐸…" など)の絵文字まで
    // <img> に置換されてタグが壊れる。DOM に対して parse すればテキストノードだけが対象になる。
    this.content_.innerHTML = body;

    // サーバが SSR した <title> と同じ形にすること(server/src/lib/meta.ts の pageTitle)。
    // twemoji.parse より前に読む。後だと絵文字が <img> になり、textContent から消える。
    // TODO: 同じ組み立てをサーバとクライアントで二重に持っている。増えてきたら
    // protocol.ts のように共有する場所へ移すか考える。
    const titles = this.content_.getElementsByClassName("title");
    if(titles.length > 0) {
      const title = titles[0].textContent ?? "";
      this.title_ = `${title} :: the gear of seasons`;
      if(this.kind_ === 'moment') {
        this.momentTitle_ = title;
      }
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
    this.loaded_ = true;
    this.bodyShown_ = true;
    // 最上位なら、ここで page_view が送られ、続けて onPageViewSent で view_item が送られる。
    this.world.notifyLoaded(this);
    // landing では page_view が本文より先に送られているので、ここで view_item を送り、深さを測る。
    if(this.viewItemPendingVia_ !== null) {
      this.viewMoment_(this.viewItemPendingVia_);
    }
    this.measureScroll_();
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
    this.loaded_ = true;
    // 題が無いので view_item は送らない。
    this.viewItemPendingVia_ = null;
    this.world.notifyLoaded(this);
  }

  // landing なら SSR の題がもう正しい。そうでなければ本文の .title から決まる。
  override get titleKnown(): boolean {
    return this.landing_ || this.loaded_;
  }

  // この表示の深さを測り始める。moment なら view_item を送る(本文がまだなら、届いたとき(onLoad_)に送る)。
  override onPageViewSent(via: analytics.NavVia) {
    this.scrollDepth_ = new ScrollDepthTracker(this.kind_);
    this.measureScroll_();
    if(this.kind_ !== 'moment') {
      return;
    }
    if(this.loaded_) {
      this.viewMoment_(via);
    } else {
      this.viewItemPendingVia_ = via;
    }
  }

  private viewMoment_(via: analytics.NavVia) {
    this.viewItemPendingVia_ = null;
    if(this.momentTitle_ !== null) {
      analytics.viewMoment({ path: this.path, title: this.momentTitle_ }, via);
    }
  }

  onAttached() {
    this.world.canvas.addEventListener('mouseup', this.backdropListener_, false);
    document.addEventListener('visibilitychange', this.visibilityListener_, false);
    if(document.visibilityState !== 'hidden') {
      this.startEngagement_();
    }
  }

  onDetached() {
    // 閉じる・背景・フッターのリンクで離れるときは、もう engagement を終えている。残るのは戻る・進む。
    this.endEngagement_('history');
    // 本文が届く前に離れたら、view_item は送らない(page_view と同じ)。
    this.viewItemPendingVia_ = null;
    this.scrollDepth_ = null;
    this.world.canvas.removeEventListener('mouseup', this.backdropListener_, false);
    document.removeEventListener('visibilitychange', this.visibilityListener_, false);
  }

  // タブが隠れたら、いまの engagement を終えて送る。戻ってきたら、次の engagement を始める。
  private onVisibilityChange_() {
    if(document.visibilityState === 'hidden') {
      this.endEngagement_('hidden');
    } else if(this.engagement_ === null) {
      this.startEngagement_();
    }
  }

  private startEngagement_() {
    this.engagement_ = new PageEngagement(this.kind_, performance.now());
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

  // この表示の page_view を送った後(scrollDepth_ がある間)で、本文を表示できているときだけ測る。
  // 本文の画像がすべて読み込まれる(か失敗する)までも測らない。読み込む前の <img> は高さが 0 で
  // (CSS で width・height を auto にしている)、長い本文でも短く見え、すぐに 100% になってしまう。
  private measureScroll_() {
    if(this.scrollDepth_ === null || !this.bodyShown_) {
      return;
    }
    for(const img of Array.from(this.content_.getElementsByTagName('img'))) {
      if(!img.complete) {
        return;
      }
    }
    this.scrollDepth_.measure(this.content_);
  }

  /** @override */
  destroy() {
  }
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
