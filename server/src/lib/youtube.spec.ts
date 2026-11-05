import { describe, it } from 'mocha';
import assert from 'assert';

import { youtubeEmbedURL, youtubeWatchURL } from './youtube.js';

describe("youtube", () => {
  it("正規形の URL と埋め込みの URL", () => {
    assert.equal(youtubeWatchURL('jLfOrvniehM'), 'https://www.youtube.com/watch?v=jLfOrvniehM');
    assert.equal(youtubeEmbedURL('jLfOrvniehM'), 'https://www.youtube-nocookie.com/embed/jLfOrvniehM');
  });
});
