import { describe, it } from 'mocha';
import assert from 'assert';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import Asset from '../../../lib/Asset.js';
import { PageMeta } from '../../../lib/meta.js';
import { kInternalTrafficCookie } from '../../../lib/InternalTraffic.js';

import OmoteTemplate from './OmoteTemplate.js';

const kMeta: PageMeta = {
  siteTitle: 'site',
  title: 'title',
  description: 'description',
  canonical: 'https://hexe.test/',
  ogType: 'website',
  ogImage: undefined,
  ogImageAlt: undefined,
  publishedTime: undefined,
};

async function render(gaMeasurementID: string | null): Promise<string> {
  return (await OmoteTemplate.create(new Asset(), gaMeasurementID)).render(kMeta);
}

describe("omote のシェルと Google tag", () => {
  it("測定 ID が無ければ gtag.js を読み込まず、gtag() は dataLayer に積むだけ", async () => {
    const html = await render(null);
    assert.ok(html.includes('function gtag(){dataLayer.push(arguments);}'), html);
    assert.ok(!html.includes('googletagmanager.com'), html);
    assert.ok(!html.includes("gtag('config'"), html);
  });

  it("測定 ID があれば gtag.js を読み込み、自動の page_view を止める", async () => {
    const html = await render('G-TEST123');
    assert.ok(html.includes('<script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"></script>'), html);
    assert.ok(html.includes("gtag('config', 'G-TEST123', { send_page_view: false });"), html);
    // gtag() の定義は main.js より前に置く(main.js が送るイベントを取りこぼさない)。
    assert.ok(html.indexOf('function gtag()') < html.indexOf('/js/main.js'), html);
  });

  it("運営者の印の Cookie を読み、config より前に gtag('set') で積む", async () => {
    const html = await render('G-TEST123');
    // サーバが付ける Cookie と、シェルが読む Cookie の名前がそろっている。
    assert.ok(html.includes(`c.trim() === '${kInternalTrafficCookie}=1'`), html);
    const set = html.indexOf("gtag('set', { traffic_type: 'internal', debug_mode: true });");
    assert.ok(set >= 0, html);
    assert.ok(set < html.indexOf("gtag('config'"), html);
  });

  it("index.hbs を読むのは OmoteTemplate だけ(omote のページはこのクラスでシェルを描く)", async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const files = (await readdir(root, { recursive: true }))
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
    const readers: string[] = [];
    for (const f of files) {
      if ((await readFile(path.join(root, f), 'utf8')).includes('omote/index.hbs')) {
        readers.push(f.split(path.sep).join('/'));
      }
    }
    assert.deepStrictEqual(readers, ['controller/omote/lib/OmoteTemplate.ts']);
  });
});
