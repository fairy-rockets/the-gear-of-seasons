import { describe, it } from 'mocha';
import assert from 'assert';
import crypto from 'crypto';

import { YouTubeDataAPI, YouTubeVideoResource } from '../lib/YouTubeDataAPI.js';
import {
  ExternalVideoError,
  YouTubePlatform,
  externalVideoEntityID,
  parseISODuration,
  youtubeVideoInfo,
} from './ExternalVideo.js';

function thumbnails(id: string, names: string[]) {
  const files: { [name: string]: string } = {
    default: 'default', medium: 'mqdefault', high: 'hqdefault', standard: 'sddefault', maxres: 'maxresdefault',
  };
  return Object.fromEntries(names.map((n) => [n, { url: `https://i.ytimg.com/vi/${id}/${files[n]}.jpg` }]));
}

// 実際の videos.list の応答から、使う項目を抜き出したもの。
const kShorts: YouTubeVideoResource = {
  id: 'jLfOrvniehM',
  snippet: {
    publishedAt: '2026-08-29T07:05:52Z',
    liveBroadcastContent: 'none',
    thumbnails: thumbnails('jLfOrvniehM', ['default', 'high', 'maxres', 'medium', 'standard']),
  },
  contentDetails: { duration: 'PT1M' },
  player: { embedWidth: '508', embedHeight: '720' },
};

const kLong: YouTubeVideoResource = {
  id: '5WDuZByHZQA',
  snippet: {
    publishedAt: '2026-07-06T03:30:40Z',
    liveBroadcastContent: 'none',
    thumbnails: thumbnails('5WDuZByHZQA', ['default', 'high', 'maxres', 'medium', 'standard']),
  },
  contentDetails: { duration: 'PT2H18M35S' },
  player: { embedWidth: '1280', embedHeight: '720' },
};

// 生放送のアーカイブ。publishedAt は配信開始より後になる。
const kLiveArchive: YouTubeVideoResource = {
  id: 'TXt9E_dNVms',
  snippet: {
    publishedAt: '2025-01-04T19:23:59Z',
    liveBroadcastContent: 'none',
    thumbnails: thumbnails('TXt9E_dNVms', ['default', 'high', 'maxres', 'medium', 'standard']),
  },
  contentDetails: { duration: 'PT1H4M16S' },
  player: { embedWidth: '1280', embedHeight: '720' },
  liveStreamingDetails: { actualStartTime: '2025-01-04T06:14:49Z' },
};

describe("youtubeVideoInfo", () => {
  it("Shorts は縦長の埋め込みの大きさになる", () => {
    const info = youtubeVideoInfo(kShorts);
    assert.strictEqual(info.timestamp.toISOString(), '2026-08-29T07:05:52.000Z');
    assert.strictEqual(info.width, 508);
    assert.strictEqual(info.height, 720);
    assert.strictEqual(info.duration, 60);
    assert.strictEqual(info.thumbnailURL, 'https://i.ytimg.com/vi/jLfOrvniehM/maxresdefault.jpg');
  });
  it("配信でなければ publishedAt を時刻にする", () => {
    const info = youtubeVideoInfo(kLong);
    assert.strictEqual(info.timestamp.toISOString(), '2026-07-06T03:30:40.000Z');
    assert.strictEqual(info.duration, 2 * 3600 + 18 * 60 + 35);
    assert.deepStrictEqual([info.width, info.height], [1280, 720]);
  });
  it("生放送のアーカイブは、publishedAt ではなく配信開始の時刻にする", () => {
    const info = youtubeVideoInfo(kLiveArchive);
    assert.strictEqual(info.timestamp.toISOString(), '2025-01-04T06:14:49.000Z');
    assert.strictEqual(info.duration, 3600 + 4 * 60 + 16);
  });
  it("サムネイルは maxres → standard → high の順で、最初にあるもの", () => {
    const pick = (names: string[]) => youtubeVideoInfo({
      ...kLong, snippet: { ...kLong.snippet, thumbnails: thumbnails('x', names) },
    }).thumbnailURL;
    assert.strictEqual(pick(['high', 'standard', 'maxres']), 'https://i.ytimg.com/vi/x/maxresdefault.jpg');
    assert.strictEqual(pick(['default', 'high', 'standard']), 'https://i.ytimg.com/vi/x/sddefault.jpg');
    assert.strictEqual(pick(['default', 'medium', 'high']), 'https://i.ytimg.com/vi/x/hqdefault.jpg');
    assert.throws(() => pick(['default', 'medium']), ExternalVideoError);
  });
  it("埋め込みの大きさは文字列（int64。実際の応答）でも数でも読む", () => {
    const info = youtubeVideoInfo({ ...kLong, player: { embedWidth: 1280, embedHeight: 720 } });
    assert.deepStrictEqual([info.width, info.height], [1280, 720]);
  });
  for (const [live, why] of [['live', '配信中'], ['upcoming', '配信予定']]) {
    it(`${why}（liveBroadcastContent = ${live}）は取り込まない`, () => {
      assert.throws(
        () => youtubeVideoInfo({ ...kLiveArchive, snippet: { ...kLiveArchive.snippet, liveBroadcastContent: live } }),
        (e: unknown) => e instanceof ExternalVideoError && e.statusCode === 400 && e.message.includes(why));
    });
  }
  it("liveBroadcastContent が無ければ取り込まない", () => {
    assert.throws(
      () => youtubeVideoInfo({ ...kLong, snippet: { ...kLong.snippet, liveBroadcastContent: undefined } }),
      ExternalVideoError);
  });
  it("長さ・大きさ・時刻が読めなければ取り込まない", () => {
    assert.throws(() => youtubeVideoInfo({ ...kLong, contentDetails: { duration: 'xx' } }), ExternalVideoError);
    assert.throws(() => youtubeVideoInfo({ ...kLong, player: {} }), ExternalVideoError);
    assert.throws(() => youtubeVideoInfo({ ...kLong, player: { embedWidth: '0', embedHeight: '720' } }), ExternalVideoError);
    assert.throws(() => youtubeVideoInfo({ ...kLong, player: { embedWidth: '12.5', embedHeight: '720' } }), ExternalVideoError);
    assert.throws(() => youtubeVideoInfo({ ...kLong, snippet: { ...kLong.snippet, publishedAt: undefined } }), ExternalVideoError);
  });
});

describe("parseISODuration", () => {
  it("ISO 8601 の期間を秒にする", () => {
    assert.strictEqual(parseISODuration('PT1M'), 60);
    assert.strictEqual(parseISODuration('PT2H18M35S'), 8315);
    assert.strictEqual(parseISODuration('PT45S'), 45);
    assert.strictEqual(parseISODuration('P1DT1S'), 86401);
    assert.strictEqual(parseISODuration('P0D'), 0);
  });
  it("期間でない文字列は弾く", () => {
    for (const s of ['', 'P', 'PT', '1M', 'PT1X', 'PTM']) {
      assert.throws(() => parseISODuration(s), Error, s);
    }
  });
});

class FakeAPI implements YouTubeDataAPI {
  readonly calls: string[] = [];
  constructor(private readonly videos: YouTubeVideoResource[]) {}
  async findVideo(id: string) {
    this.calls.push(`findVideo ${id}`);
    return this.videos.find((v) => v.id === id) ?? null;
  }
  async fetchImage(url: string) {
    this.calls.push(`fetchImage ${url}`);
    return Buffer.from('thumbnail');
  }
}

describe("YouTubePlatform", () => {
  const platform = new YouTubePlatform(new FakeAPI([kShorts]));
  it("YouTube の URL から、platform と動画 ID を返す", () => {
    for (const url of ['https://youtube.com/shorts/jLfOrvniehM?si=x', 'https://youtu.be/jLfOrvniehM', 'https://www.youtube.com/watch?v=jLfOrvniehM']) {
      assert.deepStrictEqual(platform.match(url), { platform: 'youtube', id: 'jLfOrvniehM' }, url);
    }
  });
  it("YouTube 以外の URL は null", () => {
    assert.strictEqual(platform.match('https://example.com/watch?v=jLfOrvniehM'), null);
    assert.strictEqual(platform.match('not a url'), null);
  });
  it("YouTube の URL でも動画を指していなければ 400", () => {
    assert.throws(() => platform.match('https://www.youtube.com/@channel'),
      (e: unknown) => e instanceof ExternalVideoError && e.statusCode === 400);
  });
  it("entity の id は youtube:<動画ID> の md5", () => {
    const video = platform.match('https://youtu.be/jLfOrvniehM')!;
    assert.strictEqual(externalVideoEntityID(video), crypto.createHash('md5').update('youtube:jLfOrvniehM').digest('hex'));
    assert.match(externalVideoEntityID(video), /^[0-9a-f]{32}$/);
  });
  it("動画とサムネイルを取る", async () => {
    const api = new FakeAPI([kShorts]);
    const { info, thumbnail } = await new YouTubePlatform(api).fetch(platform.match('https://youtu.be/jLfOrvniehM')!);
    assert.strictEqual(info.width, 508);
    assert.strictEqual(thumbnail.toString(), 'thumbnail');
    assert.deepStrictEqual(api.calls, ['findVideo jLfOrvniehM', 'fetchImage https://i.ytimg.com/vi/jLfOrvniehM/maxresdefault.jpg']);
  });
  it("見つからない（items が空）なら 400 で、サムネイルは取らない", async () => {
    const api = new FakeAPI([]);
    await assert.rejects(new YouTubePlatform(api).fetch(platform.match('https://youtu.be/jLfOrvniehM')!),
      (e: unknown) => e instanceof ExternalVideoError && e.statusCode === 400);
    assert.deepStrictEqual(api.calls, ['findVideo jLfOrvniehM']);
  });
  it("API キーが無ければ 503", async () => {
    await assert.rejects(new YouTubePlatform(null).fetch(platform.match('https://youtu.be/jLfOrvniehM')!),
      (e: unknown) => e instanceof ExternalVideoError && e.statusCode === 503 && e.message.includes('YOUTUBE_API_KEY'));
  });
  it("API の失敗は 502", async () => {
    const api: YouTubeDataAPI = {
      findVideo: async () => { throw new Error('YouTube Data API: 403: quota'); },
      fetchImage: async () => Buffer.from(''),
    };
    await assert.rejects(new YouTubePlatform(api).fetch(platform.match('https://youtu.be/jLfOrvniehM')!),
      (e: unknown) => e instanceof ExternalVideoError && e.statusCode === 502 && e.message.includes('quota'));
  });
});
