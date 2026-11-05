import { describe, it, before } from 'mocha';
import assert from 'assert';
import crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import path from 'path';
import spawn from '@expo/spawn-async';
import { FastifyReply, FastifyRequest } from 'fastify';

import Repo from '../../repo/Repo.js';
import Shelf from '../../shelf/Shelf.js';
import { Entity } from '../../shelf/Entity.js';
import { YouTubePlatform } from '../../shelf/ExternalVideo.js';
import { YouTubeDataAPI, YouTubeVideoResource } from '../../lib/YouTubeDataAPI.js';

import InsertEmbedController from './InsertEmbedController.js';

// 本物の Shelf を、DB の代わりに配列で持つ Repo と、YouTube の代わりの API の上で動かす。

const kVideo: YouTubeVideoResource = {
  id: 'TXt9E_dNVms',
  snippet: {
    publishedAt: '2025-01-04T19:23:59Z',
    liveBroadcastContent: 'none',
    thumbnails: { maxres: { url: 'https://i.ytimg.com/vi/TXt9E_dNVms/maxresdefault.jpg' } },
  },
  contentDetails: { duration: 'PT1H4M16S' },
  player: { embedWidth: '1280', embedHeight: '720' },
  liveStreamingDetails: { actualStartTime: '2025-01-04T06:14:49Z' },
};
const kID = crypto.createHash('md5').update('youtube:TXt9E_dNVms').digest('hex');

class FakeRepo {
  readonly entities = new Map<string, Entity>();
  async findEntity(id: string) {
    return this.entities.get(id) ?? null;
  }
  async insertEntity(e: Entity) {
    this.entities.set(e.id, e);
  }
}

class FakeAPI implements YouTubeDataAPI {
  readonly calls: string[] = [];
  constructor(private readonly thumbnail: Buffer) {}
  async findVideo(id: string) {
    this.calls.push(`findVideo ${id}`);
    return id === kVideo.id ? kVideo : null;
  }
  async fetchImage(url: string) {
    this.calls.push(`fetchImage ${url}`);
    return this.thumbnail;
  }
}

class StubReply {
  statusCode = 200;
  contentType = '';
  body: any = undefined;
  code(c: number) { this.statusCode = c; return this; }
  type(t: string) { this.contentType = t; return this; }
  send(b: any) { this.body = b; return this; }
}

let thumbnail: Buffer;

function setup(api: YouTubeDataAPI | null) {
  const repo = new FakeRepo();
  const shelf = new Shelf(repo as unknown as Repo, [new YouTubePlatform(api)]);
  // storage（_storage/icon）には書かず、置こうとした icon の大きさだけを見る。
  const icons: string[] = [];
  (shelf as unknown as { storage: { icon: unknown } }).storage.icon = {
    upload: async (file: string) => {
      const r = await spawn('magick', ['identify', '-format', '%wx%h', file]);
      icons.push(r.stdout);
      return 'icon-hash';
    },
  };
  const c = new InsertEmbedController(shelf);
  const post = async (body: unknown) => {
    const reply = new StubReply();
    await c.handle({ body } as unknown as FastifyRequest, reply as unknown as FastifyReply);
    return reply;
  };
  return { repo, icons, post };
}

describe("POST /insert-embed", () => {
  before(async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'insert-embed-spec-'));
    try {
      const file = path.join(dir, 'thumbnail.jpg');
      await spawn('magick', ['-size', '1280x720', 'xc:#336699', file]);
      thumbnail = await fs.readFile(file);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("YouTube の URL から video の entity を作り、挿入する fml を返す", async () => {
    const api = new FakeAPI(thumbnail);
    const { repo, icons, post } = setup(api);
    const r = await post({ url: 'https://www.youtube.com/live/TXt9E_dNVms?si=abc' });
    assert.strictEqual(r.statusCode, 200);
    assert.strictEqual(r.body, `[video entity="${kID}"]`);
    assert.ok(r.contentType.startsWith('text/plain'));
    const e = repo.entities.get(kID)!;
    assert.strictEqual(e.type, 'video');
    assert.strictEqual(e.location, 'external');
    if (e.location !== 'external') return;
    assert.deepStrictEqual(e.externalRef, { platform: 'youtube', id: 'TXt9E_dNVms' });
    assert.ok(!('mimeType' in e), 'external の entity は mimeType を持たない');
    assert.strictEqual(e.timestamp!.toISOString(), '2025-01-04T06:14:49.000Z');
    assert.deepStrictEqual([e.width, e.height, e.duration], [1280, 720, 3856]);
    assert.strictEqual(e.iconID, 'icon-hash');
    assert.deepStrictEqual(icons, ['256x256']);
    assert.deepStrictEqual(api.calls, ['findVideo TXt9E_dNVms', 'fetchImage https://i.ytimg.com/vi/TXt9E_dNVms/maxresdefault.jpg']);
  });

  it("同じ動画の entity が既にあれば、YouTube に問い合わせずにそれを返す", async () => {
    const api = new FakeAPI(thumbnail);
    const { repo, icons, post } = setup(api);
    await post({ url: 'https://youtu.be/TXt9E_dNVms' });
    api.calls.length = 0;
    icons.length = 0;
    const r = await post({ url: 'https://www.youtube.com/watch?v=TXt9E_dNVms&t=10' });
    assert.strictEqual(r.statusCode, 200);
    assert.strictEqual(r.body, `[video entity="${kID}"]`);
    assert.deepStrictEqual(api.calls, []);
    assert.deepStrictEqual(icons, []);
    assert.strictEqual(repo.entities.size, 1);
  });

  it("API キーが無くても、取り込み済みの動画は返す", async () => {
    const { repo, post } = setup(null);
    const existing: Entity = {
      type: 'video', location: 'external', id: kID, iconID: 'i', timestamp: undefined,
      width: 1280, height: 720, duration: 1,
      externalRef: { platform: 'youtube', id: 'TXt9E_dNVms' },
    };
    repo.entities.set(kID, existing);
    const r = await post({ url: 'https://youtu.be/TXt9E_dNVms' });
    assert.strictEqual(r.statusCode, 200);
    assert.strictEqual(r.body, `[video entity="${kID}"]`);
  });

  for (const [name, api, body, status, includes] of [
    ['url が無い', 'fake', {}, 400, 'url'],
    ['url が文字列でない', 'fake', { url: 1 }, 400, 'url'],
    ['YouTube 以外の URL', 'fake', { url: 'https://example.com/video' }, 400, 'YouTube'],
    ['動画を指さない YouTube の URL', 'fake', { url: 'https://www.youtube.com/@ch' }, 400, 'YouTube'],
    ['見つからない動画', 'fake', { url: 'https://youtu.be/AAAAAAAAAAA' }, 400, '見つかりません'],
    ['API キーが無い', null, { url: 'https://youtu.be/TXt9E_dNVms' }, 503, 'YOUTUBE_API_KEY'],
  ] as [string, 'fake' | null, unknown, number, string][]) {
    it(`${name}なら ${status} で、理由を message に入れる`, async () => {
      const { repo, post } = setup(api === 'fake' ? new FakeAPI(thumbnail) : null);
      const r = await post(body);
      assert.strictEqual(r.statusCode, status);
      assert.strictEqual(r.body.statusCode, status);
      assert.ok(r.body.message.includes(includes), r.body.message);
      assert.strictEqual(repo.entities.size, 0);
    });
  }
});
