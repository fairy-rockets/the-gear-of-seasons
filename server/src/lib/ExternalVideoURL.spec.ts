import { describe, it } from 'mocha';
import assert from 'assert';

import { ExternalVideoURLError, matchYouTubeVideoURL } from './ExternalVideoURL.js';

describe("ExternalVideoURL", () => {
  it("YouTube の動画の URL は、platform と動画 ID にする", () => {
    for (const url of ['https://youtu.be/5WDuZByHZQA?si=x', 'https://www.youtube.com/watch?v=5WDuZByHZQA', 'https://youtube.com/shorts/5WDuZByHZQA']) {
      assert.deepStrictEqual(matchYouTubeVideoURL(url), { platform: 'youtube', id: '5WDuZByHZQA' }, url);
    }
  });
  it("YouTube の URL でなければ null", () => {
    assert.strictEqual(matchYouTubeVideoURL('https://example.com/video'), null);
    assert.strictEqual(matchYouTubeVideoURL('not a url'), null);
  });
  it("YouTube の URL でも動画を指していなければ投げる", () => {
    assert.throws(() => matchYouTubeVideoURL('https://www.youtube.com/@channel'), ExternalVideoURLError);
  });
});
