import { describe, it } from 'mocha';
import assert from 'assert';

import { renderSitemapXML } from './SitemapController.js';

describe("renderSitemapXML", () => {
  it("Empty", () => {
    assert.strictEqual(renderSitemapXML([]), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`);
  });
  it("With and without lastmod", () => {
    const xml = renderSitemapXML([
      { loc: 'https://hexe.net/' },
      { loc: 'https://hexe.net/2024/11/14/13:18:23/', lastmod: '2024-11-14' },
    ]);
    assert.ok(xml.includes(`  <url><loc>https://hexe.net/</loc></url>`), xml);
    assert.ok(xml.includes(`  <url><loc>https://hexe.net/2024/11/14/13:18:23/</loc><lastmod>2024-11-14</lastmod></url>`), xml);
  });
  // XML の文字データでエスケープが必須なのは < と &(XML 1.0 §2.4)。
  it("Escapes < and &", () => {
    const xml = renderSitemapXML([{ loc: 'https://hexe.net/?a=1&b=<2>' }]);
    assert.ok(xml.includes('<loc>https://hexe.net/?a=1&amp;b=&lt;2></loc>'), xml);
  });
});
