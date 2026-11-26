import assert from 'node:assert/strict';
import path from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { describe, it } from 'mocha';
import Asset from '../lib/Asset.js';
import { DraftJobs, generateDraft, parseDraft } from './AnnotationDraft.js';
import { ImageEntity } from './Entity.js';
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
});
