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
  code(_c: number) { return this; }
  type(_t: string) { return this; }
  send(b: any) { this.body = b; return this; }
}

async function renderIndex(): Promise<string> {
  const c = await IndexController.create(new Asset(), new StubShelf().asShelf());
  const reply = new StubReply();
  await c.handlerOf('index')({} as FastifyRequest, reply as unknown as FastifyReply);
  return reply.body as string;
}

describe("omote の Google tag", () => {
  const original = kConfig.gaMeasurementID;
  afterEach(() => {
    kConfig.gaMeasurementID = original;
  });

  it("測定 ID が無ければ gtag.js を読み込まず、gtag() は dataLayer に積むだけ", async () => {
    kConfig.gaMeasurementID = null;
    const html = await renderIndex();
    assert.ok(html.includes('function gtag(){dataLayer.push(arguments);}'), html);
    assert.ok(!html.includes('googletagmanager.com'), html);
    assert.ok(!html.includes("gtag('config'"), html);
  });

  it("測定 ID があれば gtag.js を読み込み、自動の page_view を止める", async () => {
    kConfig.gaMeasurementID = 'G-TEST123';
    const html = await renderIndex();
    assert.ok(html.includes('<script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"></script>'), html);
    assert.ok(html.includes("gtag('config', 'G-TEST123', { send_page_view: false });"), html);
    // gtag() の定義は main.js より前に置く(main.js が送るイベントを取りこぼさない)。
    assert.ok(html.indexOf('function gtag()') < html.indexOf('/js/main.js'), html);
  });
});
