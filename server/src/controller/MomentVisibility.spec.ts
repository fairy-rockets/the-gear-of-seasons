import { describe, it } from 'mocha';
import assert from 'assert';
import dayjs from 'dayjs';
import { FastifyReply, FastifyRequest } from 'fastify';

import Asset from '../lib/Asset.js';
import * as fml from '../lib/fml.js';
import * as protocol from '../lib/protocol.js';
import Shelf from '../shelf/Shelf.js';
import { momentListItem } from '../shelf/MomentList.js';
import { Moment, MomentSummary, MomentVisibility, formatMomentPath } from '../shelf/Moment.js';

import MomentController from './omote/MomentController.js';
import PickupController from './omote/PickupController.js';
import RandomSelectionController from './omote/RandomSelectionController.js';
import SitemapController from './omote/SitemapController.js';
import MomentBodyController from './both/MomentBodyController.js';
import EditController from './ura/EditController.js';
import MomentListController from './ura/MomentListController.js';
import NewController from './ura/NewController.js';

// 下書きが omote に漏れないことを、controller の単位で固定する。
// Shelf はスタブで、受け取った visibility を記録しつつ、Repo と同じ意味で絞り込む。

const kPublishedA = dayjs('2024-11-10T10:00:00+09:00');
// PickupController の kPickupMoments にある時刻。えらんだ絵でも下書きは出さない。
const kDraft = dayjs('2024-11-14T13:18:23+09:00');
const kPublishedB = dayjs('2024-11-20T22:23:01+09:00');

function moment(timestamp: dayjs.Dayjs, status: Moment['status']): Moment {
  return {
    timestamp,
    title: `${status}-${timestamp.date()}`,
    author: '宵宮ナギ',
    text: 'ほんぶん',
    iconID: `icon-${timestamp.date()}`,
    status,
    tier: 'archive',
    series: [],
    sensitive: false,
    sensitiveManual: false,
  };
}

const kDraftPath = formatMomentPath(kDraft);
const kPublishedAPath = formatMomentPath(kPublishedA);
const kPublishedBPath = formatMomentPath(kPublishedB);

class StubShelf {
  readonly visibilities: MomentVisibility[] = [];
  private readonly moments: Moment[] = [
    moment(kPublishedA, 'published'),
    moment(kDraft, 'draft'),
    moment(kPublishedB, 'published'),
  ];
  private visible(visibility: MomentVisibility): Moment[] {
    this.visibilities.push(visibility);
    return this.moments.filter((m) => visibility === 'all' || m.status === 'published');
  }
  private static summary(m: Moment): MomentSummary {
    return { timestamp: m.timestamp, title: m.title, iconID: m.iconID, status: m.status };
  }
  async findMoment(timestamp: dayjs.Dayjs, visibility: MomentVisibility): Promise<Moment | null> {
    return this.visible(visibility).find((m) => m.timestamp!!.isSame(timestamp)) ?? null;
  }
  // ura の編集画面が「自動（今は…）」に出す値。moment を引かないので visibility は関係ない。
  async computeSensitive(_text: string): Promise<boolean> {
    return false;
  }
  async findPreviousMomentSummary(timestamp: dayjs.Dayjs, visibility: MomentVisibility): Promise<MomentSummary | null> {
    const found = this.visible(visibility).filter((m) => m.timestamp!!.isBefore(timestamp));
    return found.length > 0 ? StubShelf.summary(found[found.length - 1]) : null;
  }
  async findNextMomentSummary(timestamp: dayjs.Dayjs, visibility: MomentVisibility): Promise<MomentSummary | null> {
    const found = this.visible(visibility).filter((m) => m.timestamp!!.isAfter(timestamp));
    return found.length > 0 ? StubShelf.summary(found[0]) : null;
  }
  async findMomentSummariesByRandom(_size: number, visibility: MomentVisibility): Promise<MomentSummary[]> {
    return this.visible(visibility).map(StubShelf.summary);
  }
  async findAllMomentSummaries(visibility: MomentVisibility): Promise<MomentSummary[]> {
    return this.visible(visibility).map(StubShelf.summary);
  }
  async findMomentListItems(visibility: MomentVisibility): Promise<protocol.Moment.List.Item[]> {
    return this.visible(visibility).map((m) => momentListItem(m, fml.parse(m.text), new Map()));
  }
  async findEntity(_id: string): Promise<null> {
    return null;
  }
  asShelf(): Shelf {
    return this as unknown as Shelf;
  }
}

class StubReply {
  statusCode = 200;
  body: any = undefined;
  code(c: number) { this.statusCode = c; return this; }
  type(_t: string) { return this; }
  header(_k: string, _v: string) { return this; }
  send(b: any) { this.body = b; return this; }
}

async function call(
  handler: (req: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>,
  req: Record<string, unknown>,
): Promise<StubReply> {
  const reply = new StubReply();
  await handler(req as unknown as FastifyRequest, reply as unknown as FastifyReply);
  return reply;
}

function assertOnly(shelf: StubShelf, visibility: MomentVisibility) {
  assert.ok(shelf.visibilities.length > 0, 'Shelf から moment を引いていない');
  assert.deepStrictEqual(new Set(shelf.visibilities), new Set([visibility]));
}

describe("omote は公開済みの moment だけを扱う", () => {
  const asset = new Asset();

  it("直 URL: 下書きは 404", async () => {
    const shelf = new StubShelf();
    const c = await MomentController.create(asset, shelf.asShelf());
    assert.strictEqual((await call(c.handle.bind(c), { url: kDraftPath })).statusCode, 404);
    assert.strictEqual((await call(c.handle.bind(c), { url: kPublishedAPath })).statusCode, 200);
    assertOnly(shelf, 'published');
  });

  it("本文の断片: 下書きは 404、前後ナビは下書きを飛ばす", async () => {
    const shelf = new StubShelf();
    const c = await MomentBodyController.create(shelf.asShelf());
    assert.strictEqual((await call(c.handleOmote.bind(c), { url: `/moment${kDraftPath}` })).statusCode, 404);
    const r = await call(c.handleOmote.bind(c), { url: `/moment${kPublishedAPath}` });
    assert.strictEqual(r.statusCode, 200);
    assert.ok((r.body as string).includes(`href="${kPublishedBPath}"`), r.body);
    assert.ok(!(r.body as string).includes(kDraftPath), r.body);
    assertOnly(shelf, 'published');
  });

  it("/moments/random に下書きが出ない", async () => {
    const shelf = new StubShelf();
    const c = await RandomSelectionController.create(shelf.asShelf());
    const r = await call(c.handle.bind(c), { query: { size: '100' } });
    const paths = (r.body as { path: string }[]).map((it) => it.path);
    assert.deepStrictEqual(paths, [kPublishedAPath, kPublishedBPath]);
    assertOnly(shelf, 'published');
  });

  it("/sitemap.xml に下書きが出ない", async () => {
    const shelf = new StubShelf();
    const c = await SitemapController.create(shelf.asShelf());
    const r = await call(c.handle.bind(c), {});
    assert.ok((r.body as string).includes(kPublishedAPath), r.body);
    assert.ok(!(r.body as string).includes(kDraftPath), r.body);
    assertOnly(shelf, 'published');
  });

  it("/pickup/body に下書きが出ない", async () => {
    const shelf = new StubShelf();
    const c = await PickupController.create(asset, shelf.asShelf());
    const r = await call(c.handleBody.bind(c), {});
    assert.ok((r.body as string).includes(`href="${kPublishedBPath}"`), r.body);
    assert.ok(!(r.body as string).includes(kDraftPath), r.body);
    assertOnly(shelf, 'published');
  });
});

describe("ura は下書きも扱う", () => {
  const asset = new Asset();

  it("編集画面で下書きを開け、ステータスが選ばれている", async () => {
    const shelf = new StubShelf();
    const c = await EditController.create(asset, shelf.asShelf());
    const r = await call(c.handle.bind(c), { url: kDraftPath });
    assert.strictEqual(r.statusCode, 200);
    assert.ok((r.body as string).includes('<option value="draft" selected>'), r.body);
    assertOnly(shelf, 'all');
  });

  it("本文の断片も下書きを返す", async () => {
    const shelf = new StubShelf();
    const c = await MomentBodyController.create(shelf.asShelf());
    assert.strictEqual((await call(c.handleUra.bind(c), { url: `/moment${kDraftPath}` })).statusCode, 200);
    assertOnly(shelf, 'all');
  });

  it("一覧に埋め込む要約に下書きが入り、status が付いている", async () => {
    const shelf = new StubShelf();
    const c = await MomentListController.create(asset, shelf.asShelf());
    const r = await call(c.handle.bind(c), {});
    const body = r.body as string;
    const m = /<script id="moments-data" type="application\/json">(.*?)<\/script>/s.exec(body);
    assert.ok(m !== null, body);
    const items = JSON.parse(m[1]) as protocol.Moment.List.Item[];
    assert.deepStrictEqual(items.map((it) => [it.path, it.status]), [
      [kPublishedAPath, 'published'],
      [kDraftPath, 'draft'],
      [kPublishedBPath, 'published'],
    ]);
    assertOnly(shelf, 'all');
  });

  it("新規作成の初期値は下書き", async () => {
    const c = await NewController.create(asset);
    const r = await call(c.handle.bind(c), {});
    assert.ok((r.body as string).includes('<option value="draft" selected>'), r.body);
    assert.ok(!(r.body as string).includes('<option value="published" selected>'), r.body);
  });
});
