import World from './World';
import { mat4 } from 'gl-matrix';
import Gear from './actors/Gear';

/**
 * 開いた URL(landing)のレイヤに渡す、そのページの URL と題。
 * サーバが配信した時点の値なので、本文を待たずに正しい。
 */
export type Landing = {
  // クエリ(UTM など)も含めた URL。landing の page_view の page_location にする。
  href: string;
  // サーバが SSR した <title>。
  title: string;
};

export default abstract class Layer {
  protected readonly world_: World;
  private readonly path_: string;
  private readonly href_: string;
  private readonly landingHref_: string;
  protected readonly element_: HTMLDivElement;
  protected title_: string;
  protected readonly landing_: boolean;
  protected constructor(world: World, path: string, landing?: Landing) {
    this.world_ = world;
    this.path_ = path;
    this.element_ = document.createElement('div');
    this.element_.className = 'layer-wrapper';
    // document.title はスタック最上位のレイヤから導出する(World.applyTop_)。
    // landing でなければ、題が決まるまではサイト名にしておく。
    this.href_ = location.origin + path;
    this.landingHref_ = landing?.href ?? this.href_;
    this.title_ = landing?.title ?? world.siteTitle;
    this.landing_ = landing !== undefined;
  }

  get world(): World {
    return this.world_;
  }

  get gl(): WebGLRenderingContext {
    return this.world_.gl;
  }

  get gear(): Gear {
    return this.world_.gear;
  }

  get element(): HTMLDivElement {
    return this.element_;
  }

  get path(): string {
    return this.path_;
  }

  /** page_view の page_location にする URL。 */
  get href(): string {
    return this.href_;
  }

  /** 開いたときの URL(landing ならクエリも含む)。landing の page_view にだけ使う。 */
  get landingHref(): string {
    return this.landingHref_;
  }

  get title(): string {
    return this.title_;
  }

  /** 題が決まったか。決まるまで page_view を待つ(World.applyTop_)。 */
  get titleKnown(): boolean {
    return true;
  }
  abstract render(time: number, matWorld: mat4): void;
  abstract onAttached(): void;
  abstract onDetached(): void;
  abstract destroy(): void;
}