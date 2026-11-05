import { describe, it } from 'mocha';
import assert from 'assert';

import {
  ExternalVideoFormatError,
  externalVideoEmbedURL,
  externalVideoPageURL,
  externalVideoPlayerTitle,
  parseExternalVideo,
} from './ExternalVideoFormat.js';

describe("ExternalVideoFormat", () => {
  it("YouTube の external を読む", () => {
    assert.deepStrictEqual(parseExternalVideo({ platform: 'youtube', id: 'TXt9E_dNVms' }), { platform: 'youtube', id: 'TXt9E_dNVms' });
  });
  for (const value of [
    null, 'youtube', [], {},
    { platform: 'tiktok', id: 'TXt9E_dNVms' },
    { platform: 'youtube' },
    { platform: 'youtube', id: 'short' },
    { platform: 'youtube', id: 'TXt9E_dNVms"x' },
    { platform: 'youtube', id: 12345678901 },
    { platform: 'youtube', id: 'TXt9E_dNVms', url: 'https://example.com/' },
  ]) {
    it(`不正な external（${JSON.stringify(value)}）は投げる`, () => {
      assert.throws(() => parseExternalVideo(value), ExternalVideoFormatError);
    });
  }
  it("ページと埋め込みの URL、プレイヤーの title は platform ごとに中身から組み立てる", () => {
    const video = { platform: 'youtube', id: 'jLfOrvniehM' } as const;
    assert.strictEqual(externalVideoPageURL(video), 'https://www.youtube.com/watch?v=jLfOrvniehM');
    assert.strictEqual(externalVideoEmbedURL(video), 'https://www.youtube-nocookie.com/embed/jLfOrvniehM');
    assert.strictEqual(externalVideoPlayerTitle(video), 'YouTube video player');
  });
});
