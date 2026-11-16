import { describe, it } from 'mocha';
import assert from 'assert';
import dayjs from 'dayjs';
import { FastifyReply, FastifyRequest } from 'fastify';

import Asset from '../../lib/Asset.js';
import Shelf from '../../shelf/Shelf.js';
import { Entity } from '../../shelf/Entity.js';
import { EntityAnnotation } from '../../shelf/EntityAnnotation.js';
import { Moment, formatMomentPath } from '../../shelf/Moment.js';

import IndexController, { kSiteImageID } from './IndexController.js';
import MomentController from './MomentController.js';

// og:image:alt と twitter:image:alt に、題ではなく画像の注釈の alt を出す。

const kTimestamp = dayjs('2024-11-10T10:00:00+09:00');
const kPath = formatMomentPath(kTimestamp);

function annotation(entityID: string, alt: string | null, humanVerified = false): EntityAnnotation {
  return { entityID, alt, humanVerified } as unknown as EntityAnnotation;
}

class StubShelf {
  constructor(
    private readonly iconType: Entity['type'],
    private readonly annotations: EntityAnnotation[],
    private readonly failAnnotation = false,
  ) {}
  async findMoment(_timestamp: dayjs.Dayjs): Promise<Moment> {
    return {
      timestamp: kTimestamp,
      title: '野生の冷蔵庫',
      author: '宵宮ナギ',
      text: 'at Ushiku, Ibaraki.',
      iconID: 'icon',
      status: 'published',
      tier: 'normal',
      series: [],
      intent: null,
    };
  }
  async findEntity(id: string): Promise<Entity> {
    return { id, type: this.iconType } as unknown as Entity;
  }
  async findEntityAnnotation(id: string): Promise<EntityAnnotation | null> {
    if (this.failAnnotation) {
      throw new Error('DB is down');
    }
    return this.annotations.find((a) => a.entityID === id) ?? null;
  }
  asShelf(): Shelf {
    return this as unknown as Shelf;
  }
}

class StubReply {
  body: any = undefined;
  code(_c: number) { return this; }
  type(_t: string) { return this; }
  send(b: any) { this.body = b; return this; }
}

async function call(
  handler: (req: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>,
  req: Record<string, unknown>,
): Promise<string> {
  const reply = new StubReply();
  await handler(req as unknown as FastifyRequest, reply as unknown as FastifyReply);
  return reply.body as string;
}

function assertImageAlt(html: string, alt: string) {
  assert.ok(html.includes(`<meta property="og:image:alt" content="${alt}">`), html);
  assert.ok(html.includes(`<meta name="twitter:image:alt" content="${alt}">`), html);
}

describe("OGP 画像の alt", () => {
  const asset = new Asset();

  async function momentPage(iconType: Entity['type'], annotations: EntityAnnotation[]): Promise<string> {
    const c = await MomentController.create(asset, new StubShelf(iconType, annotations).asShelf());
    return await call(c.handle.bind(c), { url: kPath });
  }

  it("moment: 未確認でも画像の注釈の alt を出す", async () => {
    const html = await momentPage('image', [annotation('icon', '道ばたに古い冷蔵庫が置かれている')]);
    assertImageAlt(html, '道ばたに古い冷蔵庫が置かれている');
  });

  for (const [name, annotations] of [
    ['注釈なし', []],
    ['空白のみ', [annotation('icon', ' \t　')]],
  ] as [string, EntityAnnotation[]][]) {
    it(`moment: ${name}の場合は題を出す`, async () => {
      assertImageAlt(await momentPage('image', annotations), '野生の冷蔵庫');
    });
  }

  it("moment: alt を属性としてエスケープする", async () => {
    const html = await momentPage('image', [annotation('icon', '"<冷蔵庫>" & 道')]);
    assertImageAlt(html, '&quot;&lt;冷蔵庫&gt;&quot; &amp; 道');
  });

  it("moment: 動画のサムネイルには題を出す", async () => {
    const html = await momentPage('video', [annotation('icon', '動画の説明')]);
    assertImageAlt(html, '野生の冷蔵庫');
  });

  it("固定ページ: サイト画像の注釈の alt を出し、無ければ題を出す", async () => {
    const annotated = await IndexController.create(asset, new StubShelf('image', [annotation(kSiteImageID, '帽子をかぶった太陽と月')]).asShelf());
    assertImageAlt(await call(annotated.handlerOf('index'), {}), '帽子をかぶった太陽と月');
    const bare = await IndexController.create(asset, new StubShelf('image', []).asShelf());
    assertImageAlt(await call(bare.handlerOf('about-us'), {}), '太陽と帽子とお月さま');
  });

  it("固定ページ: 注釈を引けなくても題でページを出す", async () => {
    const c = await IndexController.create(asset, new StubShelf('image', [], true).asShelf());
    assertImageAlt(await call(c.handlerOf('index'), {}), '太陽と帽子とお月さま');
  });
});
