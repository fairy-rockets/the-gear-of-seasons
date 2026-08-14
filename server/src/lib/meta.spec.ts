import { describe, it } from 'mocha';
import assert from 'assert';

import { pageTitle, summarizeMomentText } from './meta.js';

describe("meta", () => {
  describe("summarizeMomentText", () => {
    it("Plain text", () => {
      assert.strictEqual(summarizeMomentText(`ひとつの絵について。`), `ひとつの絵について。`);
    });
    it("Strips tags", () => {
      assert.strictEqual(
        summarizeMomentText(`<strong>強調</strong>と<a href="/">リンク</a>。`),
        `強調 と リンク 。`);
    });
    it("Collapses whitespace", () => {
      assert.strictEqual(summarizeMomentText(`あ\n\nい　 う`), `あ い う`);
    });
    it("Unescapes entities", () => {
      assert.strictEqual(summarizeMomentText(`A&amp;B &lt;タグ&gt;`), `A&B <タグ>`);
    });
    it("Does not unescape twice", () => {
      assert.strictEqual(summarizeMomentText(`&amp;lt;`), `&lt;`);
    });
    it("Skips non-text blocks", () => {
      assert.strictEqual(
        summarizeMomentText(`まえ[image entity="deadbeef"]あと`),
        `まえ あと`);
    });
    it("Drops reference lists", () => {
      assert.strictEqual(
        summarizeMomentText(`本文。<ul>\n<li><a href="https://example.com/">参考リンク</a></li>\n</ul>`),
        `本文。`);
    });
    it("Drops scripts", () => {
      assert.strictEqual(
        summarizeMomentText(`本文。<script>alert("x");</script>`),
        `本文。`);
    });
    it("Drops fml tags that failed to parse", () => {
      // パースに失敗すると text ブロックとしてそのまま残る。
      assert.strictEqual(
        summarizeMomentText(`本文。 [image entity="deadbeef"] つづき。`),
        `本文。 つづき。`);
    });
    it("Truncates long text", () => {
      const summary = summarizeMomentText('あ'.repeat(200));
      assert.strictEqual(summary, `${'あ'.repeat(120)}…`);
    });
    it("Empty text", () => {
      assert.strictEqual(summarizeMomentText(``), ``);
    });
  });
  describe("pageTitle", () => {
    it("Matches what the client builds", () => {
      // client/src/omote/layers/Page.ts の onLoad_ と同じ形。
      assert.strictEqual(pageTitle('ソラ'), 'ソラ :: the gear of seasons');
    });
  });
});
