import { describe, it } from 'mocha';
import assert from 'assert';

import { embedJSON } from './MomentListController.js';

describe("embedJSON", () => {
  it("本文に </script> や <!-- があっても、埋め込んだ <script> の要素を閉じない", () => {
    const value = [{ text: '</script><script>alert(1)</script><!--' }];
    const s = embedJSON(value);
    assert.ok(!s.includes('<'), s);
    assert.deepStrictEqual(JSON.parse(s), value);
  });
});
