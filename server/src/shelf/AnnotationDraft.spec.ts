import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setImmediate } from 'node:timers/promises';
import { describe, it } from 'mocha';
import Asset from '../lib/Asset.js';
import { DraftJobs, generateDraft, parseDraft } from './AnnotationDraft.js';
import { ImageEntity, InternalVideoEntity } from './Entity.js';
import Shelf from './Shelf.js';

const kModelValues = {
  methods: ['generate', 'draw', 'draw'], materials: ['digital'], palette: 'color', subject: '紅葉',
  alt: ' 赤い葉。 ', description: '葉の輪郭が見える。', tags: ['自然, 葉', '葉'], note: null,
};

describe('注釈の下書き', () => {
  it('生成した項目を正規化し、不正な画材や空の主題を弾く', () => {
    const draft = parseDraft(JSON.stringify(kModelValues));
    assert.deepEqual(draft.methods, ['draw', 'generate']);
    assert.equal(draft.alt, '赤い葉。');
    assert.deepEqual(draft.tags, ['自然', '葉']);
    assert.equal(parseDraft(JSON.stringify({ ...kModelValues, methods: ['capture'] })).materials, null);
    assert.throws(() => parseDraft(JSON.stringify({ ...kModelValues, materials: ['pigment'] })));
    assert.throws(() => parseDraft(JSON.stringify({ ...kModelValues, subject: ' ' })));
  });

  it('同時に1件だけを受け付け、失敗の詳細を公開せず次を受け付ける', async () => {
    const jobs = new DraftJobs();
    const id = jobs.start(async () => { throw new Error('private path'); })!;
    assert.deepEqual(jobs.get(id), { status: 'pending' });
    assert.equal(jobs.start(async () => parseDraft(JSON.stringify(kModelValues))), null);
    await setImmediate();
    const failed = jobs.get(id);
    assert.ok(failed?.status === 'failed' && !failed.message.includes('private path'));
    const draft = parseDraft(JSON.stringify(kModelValues));
    const next = jobs.start(async () => draft)!;
    await setImmediate();
    assert.deepEqual(jobs.get(next), { status: 'complete', draft });
    assert.equal(jobs.get('missing'), undefined);
  });

  it('画像の JPEG と編集画面の文脈を Ollama の構造化生成に渡す', async () => {
    const file = new Asset().pathOf('static/omote/kaede.jpg');
    const shelf = { resolveEntityPath: async () => [path.dirname(file), path.basename(file)] } as unknown as Shelf;
    const fetch = globalThis.fetch;
    let request: any;
    let endpoint = '';
    globalThis.fetch = async (url, init) => {
      endpoint = String(url);
      request = JSON.parse(init!.body as string);
      return Response.json({ response: JSON.stringify(kModelValues) });
    };
    try {
      const entity: ImageEntity = { id: 'i', type: 'image', location: 'internal', width: 1000, height: 1000,
        timestamp: undefined, mediumID: 'm', iconID: 'i', mimeType: 'image/jpeg' };
      const draft = await generateDraft(shelf, 'http://example.invalid', 'test-model', {
        entityID: entity.id, kind: 'camera', title: '題名', body: '編集途中の本文', place: '京都', note: '夕方',
      }, entity, AbortSignal.timeout(5000));
      assert.equal(endpoint, 'http://example.invalid/api/generate');
      assert.equal(request.model, 'test-model');
      assert.equal(request.stream, false);
      assert.ok(request.format.required.includes('alt'));
      assert.equal(request.images.length, 1);
      assert.equal(Buffer.from(request.images[0], 'base64').readUInt16BE(), 0xffd8);
      for (const word of ['写真', '題名', '編集途中の本文', '京都', '夕方']) assert.ok(request.prompt.includes(word));
      assert.equal(draft.subject, '紅葉');
    } finally {
      globalThis.fetch = fetch;
    }
  });

  it('GIF の先頭から最後までを最大12コマに間引き、1コマなら静止画として扱う', async function () {
    this.timeout(15000);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gear-draft-gif-spec-'));
    const fetch = globalThis.fetch;
    const run = promisify(execFile);
    try {
      const entity: ImageEntity = { id: 'i', type: 'image', location: 'internal', width: 32, height: 32,
        timestamp: undefined, mediumID: 'm', iconID: 'i', mimeType: 'image/gif' };
      // フレームごとに少しずつ明るくなる GIF。storage と同じく拡張子のないファイルから読む。
      for (const total of [1, 16]) {
        const colors = Array.from({ length: total }, (_, i) => `xc:gray(${100 * i / 15}%)`);
        await run('magick', ['-delay', '10', '-size', '32x32', ...colors, '-loop', '0', 'GIF:' + path.join(dir, 'original')]);
        const shelf = { resolveEntityPath: async () => [dir, 'original'] } as unknown as Shelf;
        globalThis.fetch = async (_url, init) => {
          const { images, prompt } = JSON.parse(init!.body as string);
          assert.equal(images.length, Math.min(12, total));
          assert.match(prompt, total === 1 ? /手描きの絵/ : /手描きアニメーション/);
          for (const [i, image] of images.entries()) {
            const frame = path.join(dir, 'check.jpg');
            await fs.writeFile(frame, Buffer.from(image as string, 'base64'));
            const { stdout } = await run('magick', [frame, '-format', '%[fx:mean]', 'info:']);
            const expected = total === 1 ? 0 : Math.round(i * 15 / 11) / 15;
            assert.ok(Math.abs(Number(stdout) - expected) < 0.025, `frame ${i}: ${stdout}, expected ${expected}`);
          }
          return Response.json({ response: JSON.stringify(kModelValues) });
        };
        await generateDraft(shelf, 'http://example.invalid', 'test-model',
          { entityID: entity.id, kind: 'drawing', title: '', body: '' }, entity, AbortSignal.timeout(10000));
      }
    } finally {
      globalThis.fetch = fetch;
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('動画から複数のコマを時間順に取り出してアニメーションの文脈を渡す', async function () {
    this.timeout(15000);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gear-draft-video-'));
    const fetch = globalThis.fetch;
    try {
      const file = path.join(dir, 'test.mp4');
      await promisify(execFile)('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=32x32:r=4:d=1',
        '-vf', "drawbox=color=white:t=fill:enable='gte(t,0.5)'", '-c:v', 'libx264', file]);
      const shelf = { resolveEntityPath: async () => [dir, 'test.mp4'] } as unknown as Shelf;
      const entity: InternalVideoEntity = { id: 'v', type: 'video', location: 'internal', width: 32, height: 32,
        duration: 1, timestamp: undefined, iconID: 'i', mimeType: 'video/mp4' };
      globalThis.fetch = async (_url, init) => {
        const { images, prompt } = JSON.parse(init!.body as string);
        assert.equal(images.length, 4);
        assert.match(prompt, /手描きアニメーション/);
        const pixels: number[] = [];
        for (const [i, image] of images.entries()) {
          const frame = path.join(dir, i + '.jpg');
          await fs.writeFile(frame, Buffer.from(image as string, 'base64'));
          const { stdout } = await promisify(execFile)('magick', [frame, '-format', '%[fx:mean]', 'info:']);
          pixels.push(Number(stdout));
        }
        assert.ok(pixels[0] < 0.1 && pixels[1] < 0.1 && pixels[2] > 0.9 && pixels[3] > 0.9);
        return Response.json({ response: JSON.stringify(kModelValues) });
      };
      await generateDraft(shelf, 'http://example.invalid', 'test-model',
        { entityID: entity.id, kind: 'drawing', title: '', body: '' }, entity, AbortSignal.timeout(10000));
    } finally {
      globalThis.fetch = fetch;
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
