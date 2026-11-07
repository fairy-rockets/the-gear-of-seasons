import { describe, it } from 'mocha';
import assert from 'assert';

import { YouTubeURLError, isYoutubeURL, parseYoutubeId, youtubeEmbedURL, youtubeWatchURL } from './youtube.js';

describe("youtube", () => {
  it("URL から動画 ID を取り出す", () => {
    const urls = [
      `https://www.youtube.com/watch?v=dQw4w9WgXcQ`,
      `https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=10`,
      `https://youtu.be/dQw4w9WgXcQ?si=abc`,
      `https://m.youtube.com/shorts/dQw4w9WgXcQ`,
      `https://www.youtube.com/live/dQw4w9WgXcQ`,
      `https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ`,
    ];
    for (const url of urls) {
      assert.equal(parseYoutubeId(url), 'dQw4w9WgXcQ', url);
      assert.ok(isYoutubeURL(url), url);
    }
  });
  it("動画 ID を取り出せない URL は弾く", () => {
    const urls = [
      undefined,
      ``,
      `dQw4w9WgXcQ`,
      `https://example.com/watch?v=dQw4w9WgXcQ`,
      `https://evil.youtube.com.example.com/watch?v=dQw4w9WgXcQ`,
      `https://www.youtube.com/watch?v=short`,
      `https://www.youtube.com/watch?v=dQw4w9WgXcQ"onload="x`,
      `https://www.youtube.com/`,
      `javascript:alert(1)`,
    ];
    for (const url of urls) {
      assert.throws(() => parseYoutubeId(url), YouTubeURLError, String(url));
    }
  });
  it("YouTube 以外の URL は YouTube の URL と見なさない", () => {
    for (const url of [``, `dQw4w9WgXcQ`, `https://example.com/watch?v=dQw4w9WgXcQ`,
      `https://evil.youtube.com.example.com/watch?v=dQw4w9WgXcQ`, `javascript:alert(1)`]) {
      assert.ok(!isYoutubeURL(url), url);
    }
  });
  it("正規形の URL と埋め込みの URL", () => {
    assert.equal(youtubeWatchURL('jLfOrvniehM'), 'https://www.youtube.com/watch?v=jLfOrvniehM');
    assert.equal(youtubeEmbedURL('jLfOrvniehM'), 'https://www.youtube-nocookie.com/embed/jLfOrvniehM');
  });
});
