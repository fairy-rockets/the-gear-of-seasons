import { describe, it } from 'mocha';
import assert from 'assert';
import { FastifyReply, FastifyRequest } from 'fastify';

import * as protocol from '../../lib/protocol.js';
import Repo from '../../repo/Repo.js';
import Shelf from '../../shelf/Shelf.js';
import { Entity } from '../../shelf/Entity.js';
import { EntityAnnotation } from '../../shelf/EntityAnnotation.js';

import AnnotationController from './AnnotationController.js';

// 本物の Shelf を、DB の代わりに Map で持つ Repo の上で動かす。

const kImage = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const kAudio = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const kMissing = 'cccccccccccccccccccccccccccccccc';
const kExternal = 'dddddddddddddddddddddddddddddddd';

const kEntities: Entity[] = [
  { type: 'image', location: 'internal', id: kImage, mediumID: 'm', iconID: 'i', timestamp: undefined, mimeType: 'image/png', width: 1, height: 1 },
  { type: 'audio', location: 'internal', id: kAudio, iconID: 'i', timestamp: undefined, mimeType: 'audio/mpeg', duration: 1 },
  {
    type: 'video', location: 'external', id: kExternal, iconID: 'i', timestamp: undefined, width: 1280, height: 720, duration: 60,
    externalRef: { platform: 'youtube', id: 'dQw4w9WgXcQ' },
  },
];

const kEmpty: protocol.AnnotationValues = protocol.emptyAnnotationValues();

class FakeRepo {
  readonly annotations = new Map<string, EntityAnnotation>();
  async findEntity(id: string) {
    return kEntities.find((e) => e.id === id) ?? null;
  }
  async findEntityAnnotations(ids: string[]) {
    return new Map([...this.annotations].filter(([id]) => ids.includes(id)));
  }
  async upsertEntityAnnotation(a: EntityAnnotation) {
    this.annotations.set(a.entityID, a);
  }
}

class StubReply {
  statusCode = 200;
  body: any = undefined;
  code(c: number) { this.statusCode = c; return this; }
  type(_t: string) { return this; }
  send(b: any) { this.body = b; return this; }
}

function setup() {
  const repo = new FakeRepo();
  const c = new AnnotationController(new Shelf(repo as unknown as Repo));
  const find = async (query: Record<string, unknown>) => {
    const reply = new StubReply();
    await c.handleFind({ query } as unknown as FastifyRequest, reply as unknown as FastifyReply);
    return reply;
  };
  const save = async (body: unknown) => {
    const reply = new StubReply();
    await c.handleSave({ body } as unknown as FastifyRequest, reply as unknown as FastifyReply);
    return reply;
  };
  return { repo, find, save };
}

describe("GET /annotations", () => {
  it("entity ごとに種類と注釈を返す。行が無ければ未入力の値、entity が無い id は入れない", async () => {
    const { repo, find } = setup();
    repo.annotations.set(kImage, { entityID: kImage, ...kEmpty, alt: '', humanVerified: true });
    const r = await find({ ids: `${kImage},${kAudio},${kMissing},${kImage}` });
    assert.strictEqual(r.statusCode, 200);
    assert.deepStrictEqual(r.body as protocol.Annotation.Find.Response, {
      entities: [
        { entityID: kImage, type: 'image', annotation: { ...kEmpty, alt: '', humanVerified: true } },
        { entityID: kAudio, type: 'audio', annotation: kEmpty },
      ],
    });
  });

  it("空の ids なら空の一覧を返す", async () => {
    const { find } = setup();
    const r = await find({ ids: '' });
    assert.strictEqual(r.statusCode, 200);
    assert.deepStrictEqual(r.body, { entities: [] });
  });

  for (const query of [{}, { ids: ['a', 'b'] }, { ids: `${kImage},../etc` }, { ids: kImage.toUpperCase() }]) {
    it(`id の形が合わなければ 400: ${JSON.stringify(query)}`, async () => {
      const { find } = setup();
      assert.strictEqual((await find(query)).statusCode, 400);
    });
  }
});

describe("POST /annotation", () => {
  const request = (annotation: Partial<protocol.AnnotationValues>) => ({
    entityID: kImage,
    annotation: { ...kEmpty, ...annotation },
  });

  it("保存すると 204 を返す", async () => {
    const { repo, save } = setup();
    const r = await save(request({ methods: ['draw'], subject: '海', note: '補足', palette: 'color' }));
    assert.strictEqual(r.statusCode, 204);
    assert.deepStrictEqual(repo.annotations.get(kImage), {
      entityID: kImage, ...kEmpty, methods: ['draw'], subject: '海', note: '補足', palette: 'color',
    });
  });

  it("methods は kAnnotationMethods の順にそろえて書く", async () => {
    const { repo, save } = setup();
    assert.strictEqual((await save(request({ methods: ['generate', 'draw'] }))).statusCode, 204);
    assert.deepStrictEqual(repo.annotations.get(kImage)!!.methods, ['draw', 'generate']);
  });

  it("音声にも methods・subject・note・human_verified を書ける", async () => {
    const { repo, save } = setup();
    const values = { methods: ['capture', 'compose'], subject: '雨音', note: 'n', humanVerified: true } as const;
    const r = await save({ ...request({ ...values, methods: [...values.methods] }), entityID: kAudio });
    assert.strictEqual(r.statusCode, 204);
    assert.deepStrictEqual(repo.annotations.get(kAudio), { entityID: kAudio, ...kEmpty, ...values, methods: ['capture', 'compose'] });
  });

  it("外部の動画（YouTube）にも注釈を書けて、読み直せる", async () => {
    const { repo, save, find } = setup();
    const values: Partial<protocol.AnnotationValues> = {
      methods: ['capture'], subject: '夕暮れ', alt: 'a', tags: ['空'], palette: 'color', note: 'n', humanVerified: true,
    };
    const r = await save({ ...request(values), entityID: kExternal });
    assert.strictEqual(r.statusCode, 204);
    assert.deepStrictEqual(repo.annotations.get(kExternal), { entityID: kExternal, ...kEmpty, ...values });
    const found = await find({ ids: kExternal });
    assert.deepStrictEqual(found.body as protocol.Annotation.Find.Response, {
      entities: [{ entityID: kExternal, type: 'video', annotation: { ...kEmpty, ...values } }],
    });
  });

  it("空の文字列と空のリストは、null に変えずにそのまま書く", async () => {
    const { repo, save } = setup();
    await save(request({ alt: '', tags: [], characters: ['a'], methods: ['draw'], materials: [] }));
    const a = repo.annotations.get(kImage)!!;
    assert.deepStrictEqual([a.alt, a.tags, a.characters, a.materials, a.description], ['', [], ['a'], [], null]);
  });

  const invalid: [string, unknown][] = [
    ['alt が数', request({ alt: 1 as any })],
    ['tags が文字列', request({ tags: 'a,b' as any })],
    ['materials が文字列', request({ materials: 'digital' as any })],
    ['materials が欠けている', { ...request({}), annotation: (({ materials: _, ...rest }) => rest)(kEmpty) }],
    ['humanVerified が null', request({ humanVerified: null as any })],
    ['subject が数', request({ subject: 1 as any })],
    ['note がリスト', request({ note: ['a'] as any })],
    ['methods が文字列', request({ methods: 'draw' as any })],
    ['methods が空', request({ methods: [] })],
    ['methods が重複している', request({ methods: ['draw', 'draw'] })],
    ['methods が定義に無い', request({ methods: ['oil'] as any })],
    ['古い項目 medium がある', { ...request({}), annotation: { ...kEmpty, medium: 'drawing' } }],
    ['methods に draw が無いのに materials がある', request({ methods: ['capture'], materials: ['digital'] })],
    ['methods が無いのに materials が空のリスト', request({ materials: [] })],
    ['項目が欠けている', { ...request({}), annotation: (({ alt: _, ...rest }) => rest)(kEmpty) }],
    ['定義に無い項目がある', { ...request({}), annotation: { ...kEmpty, colour: 'red' } }],
    ['annotation が無い', { entityID: kImage }],
    ['entityID の形が違う', { ...request({}), entityID: 'img' }],
    ['本文が無い', null],
  ];
  for (const [name, body] of invalid) {
    it(`${name}なら 400 で、何も書かない`, async () => {
      const { repo, save } = setup();
      const r = await save(body);
      assert.strictEqual(r.statusCode, 400, JSON.stringify(r.body));
      assert.ok(typeof r.body.message === 'string' && r.body.message.length > 0);
      assert.strictEqual(repo.annotations.size, 0);
    });
  }

  it("その種類が持たない項目を送ると例外になり、何も書かない", async () => {
    const { repo, save } = setup();
    await assert.rejects(() => save({ ...request({ palette: 'color' }), entityID: kAudio }), /cannot have palette/);
    await assert.rejects(() => save({ ...request({ methods: ['draw'], materials: ['digital'] }), entityID: kAudio }), /cannot have materials/);
    assert.strictEqual(repo.annotations.size, 0);
  });


  it("無い entity の注釈は例外になる", async () => {
    const { repo, save } = setup();
    await assert.rejects(() => save({ ...request({}), entityID: kMissing }), /Entity not found/);
    assert.strictEqual(repo.annotations.size, 0);
  });
});
