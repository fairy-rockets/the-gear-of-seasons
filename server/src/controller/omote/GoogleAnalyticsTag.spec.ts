import { describe, it, afterEach } from 'mocha';
import assert from 'assert';
import { FastifyReply, FastifyRequest } from 'fastify';

import kConfig from '../../Config.js';
import Asset from '../../lib/Asset.js';
import Shelf from '../../shelf/Shelf.js';

import IndexController from './IndexController.js';

// omote のシェル(index.hbs)に入れる Google tag。

class StubShelf {
  async findEntityAnnotation(_id: string) {
    return null;
  }
  asShelf(): Shelf {
    return this as unknown as Shelf;
  }
}

class StubReply {
  body: any = undefined;
  headers: Record<string, string> = {};
  code(_c: number) { return this; }
  type(_t: string) { return this; }
  header(k: string, v: string) { this.headers[k] = v; return this; }
  send(b: any) { this.body = b; return this; }
}

async function renderIndex(cookie?: string): Promise<StubReply> {
  const c = await IndexController.create(new Asset(), new StubShelf().asShelf());
  const reply = new StubReply();
  await c.handlerOf('index')({ headers: { cookie } } as unknown as FastifyRequest, reply as unknown as FastifyReply);
  return reply;
}

describe("omote の Google tag", () => {
  const original = kConfig.gaMeasurementID;
  afterEach(() => {
    kConfig.gaMeasurementID = original;
  });

  it("測定 ID が無ければ gtag.js を読み込まず、gtag() は dataLayer に積むだけ", async () => {
    kConfig.gaMeasurementID = null;
    const html = (await renderIndex()).body;
    assert.ok(html.includes('function gtag(){dataLayer.push(arguments);}'), html);
    assert.ok(!html.includes('googletagmanager.com'), html);
    assert.ok(!html.includes("gtag('config'"), html);
  });

  it("測定 ID があれば gtag.js を読み込み、自動の page_view を止める", async () => {
    kConfig.gaMeasurementID = 'G-TEST123';
    const html = (await renderIndex('other=1')).body;
    assert.ok(html.includes('<script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"></script>'), html);
    assert.ok(html.includes("gtag('config', 'G-TEST123', { send_page_view: false });"), html);
    assert.ok(!html.includes('traffic_type'), html);
    // gtag() の定義は main.js より前に置く(main.js が送るイベントを取りこぼさない)。
    assert.ok(html.indexOf('function gtag()') < html.indexOf('/js/main.js'), html);
  });

  it("運営者の閲覧の印があれば traffic_type と debug_mode を付ける", async () => {
    kConfig.gaMeasurementID = 'G-TEST123';
    const reply = await renderIndex('a=b; gear_internal=1');
    assert.ok(reply.body.includes("gtag('config', 'G-TEST123', { send_page_view: false, traffic_type: 'internal', debug_mode: true });"), reply.body);
    assert.ok(!reply.body.includes("gtag('config', 'G-TEST123', { send_page_view: false });"), reply.body);
    // 印の有無で中身が変わるので、キャッシュは Cookie ごとに分けさせる。
    assert.strictEqual(reply.headers['Vary'], 'Cookie');
  });
});
