import { describe, it } from 'mocha';
import assert from 'assert';

import { parseMomentStatus } from './Moment.js';

describe("parseMomentStatus", () => {
  it("draft と published はそのまま通す", () => {
    assert.strictEqual(parseMomentStatus('draft'), 'draft');
    assert.strictEqual(parseMomentStatus('published'), 'published');
  });
  // 欠けた値を draft/published に読み替えると、status を送らない古いクライアントからの
  // 保存で公開状態が黙って変わってしまう。
  it("それ以外は欠けた値も含めて例外にする", () => {
    for (const v of ['unlisted', '', 'Published', undefined, null, 1]) {
      assert.throws(() => parseMomentStatus(v), /Invalid moment status/, String(v));
    }
  });
});
