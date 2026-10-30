import { describe, it } from 'mocha';
import assert from 'assert';
import dayjs from 'dayjs';
import { FastifyReply, FastifyRequest } from 'fastify';

import * as protocol from '../../lib/protocol.js';
import Repo from '../../repo/Repo.js';
import Shelf from '../../shelf/Shelf.js';
import { Entity } from '../../shelf/Entity.js';
import { EntityAnnotation } from '../../shelf/EntityAnnotation.js';
import { Moment, MomentVisibility, formatMomentTime } from '../../shelf/Moment.js';

import AnnotationController from './AnnotationController.js';

// 本物の Shelf を、DB の代わりに配列で持つ Repo の上で動かし、保存から sensitive の計算し直しまでを通して見る。

const kImage = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const kAudio = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const kMissing = 'cccccccccccccccccccccccccccccccc';

const kEntities: Entity[] = [
  { type: 'image', id: kImage, mediumID: 'm', iconID: 'i', timestamp: undefined, mimeType: 'image/png', width: 1, height: 1 },
  { type: 'audio', id: kAudio, iconID: 'i', timestamp: undefined, mimeType: 'audio/mpeg', duration: 1 },
];

const kEmpty: protocol.AnnotationValues = {
  medium: null, alt: null, description: null, tags: null, palette: null, characters: null,
  looksNude: null, looksChild: null, looksNote: null, checked: false,
  role: null, roleGroup: null, roleStar: null, roleNote: null,
};

const kAuto = dayjs('2020-01-02T03:04:05+09:00');
const kManual = dayjs('2020-01-03T03:04:05+09:00');

function moment(timestamp: dayjs.Dayjs, sensitiveManual: boolean): Moment {
  return {
    timestamp, title: 't', author: 'a', text: `[image entity="${kImage}"]`, iconID: kImage, status: 'draft',
    tier: 'archive', series: [], sensitive: false, sensitiveManual,
  };
}

class FakeRepo {
  readonly log: string[] = [];
  readonly annotations = new Map<string, EntityAnnotation>();
  readonly moments: Moment[] = [moment(kAuto, false), moment(kManual, true)];
  async transaction<T>(fn: (tx: Repo) => Promise<T>): Promise<T> {
    this.log.push('BEGIN');
    // 書き込みは、COMMIT するまで annotations・moments に入れない。
    const tx = new FakeTx(this);
    try {
      const r = await fn(tx as unknown as Repo);
      tx.commit();
      this.log.push('COMMIT');
      return r;
    } catch (err) {
      this.log.push('ROLLBACK');
      throw err;
    }
  }
  async findEntity(id: string) {
    return kEntities.find((e) => e.id === id) ?? null;
  }
  async findEntityAnnotations(ids: string[]) {
    return new Map([...this.annotations].filter(([id]) => ids.includes(id)));
  }
  async findMoment(timestamp: dayjs.Dayjs, _v: MomentVisibility) {
    return this.moments.find((m) => m.timestamp!!.isSame(timestamp)) ?? null;
  }
}

class FakeTx {
  private readonly annotations: Map<string, EntityAnnotation>;
  private readonly autoSensitive = new Map<string, boolean>();
  constructor(private readonly repo: FakeRepo) {
    this.annotations = new Map(repo.annotations);
  }
  commit() {
    this.repo.annotations.clear();
    for (const [id, a] of this.annotations) {
      this.repo.annotations.set(id, a);
    }
    for (const m of this.repo.moments) {
      const v = this.autoSensitive.get(m.timestamp!!.toISOString());
      if (v !== undefined) {
        m.sensitive = v;
      }
    }
  }
  async findEntity(id: string) {
    return this.repo.findEntity(id);
  }
  async upsertEntityAnnotation(a: EntityAnnotation) {
    this.annotations.set(a.entityID, a);
  }
  async findEntityAnnotations(ids: string[]) {
    return new Map([...this.annotations].filter(([id]) => ids.includes(id)));
  }
  async findAutoSensitiveMomentCandidates(id: string) {
    return this.repo.moments.filter((m) => !m.sensitiveManual && m.text.includes(id));
  }
  async updateMomentAutoSensitive(timestamp: dayjs.Dayjs, v: boolean) {
    this.autoSensitive.set(timestamp.toISOString(), v);
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
    repo.annotations.set(kImage, { entityID: kImage, ...kEmpty, alt: '', checked: true });
    const r = await find({ ids: `${kImage},${kAudio},${kMissing},${kImage}` });
    assert.strictEqual(r.statusCode, 200);
    assert.deepStrictEqual(r.body as protocol.Annotation.Find.Response, {
      entities: [
        { entityID: kImage, type: 'image', annotation: { ...kEmpty, alt: '', checked: true } },
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
  const request = (annotation: Partial<protocol.AnnotationValues>, originalDate: string | null = formatMomentTime(kAuto)) => ({
    entityID: kImage,
    originalDate,
    annotation: { ...kEmpty, ...annotation },
  });

  it("保存すると、その entity を含む moment の sensitive が計算し直され、応答に入る", async () => {
    const { repo, save } = setup();
    const r = await save(request({ looksNude: 'nude', looksChild: 'child' }));
    assert.strictEqual(r.statusCode, 200);
    assert.deepStrictEqual(repo.log, ['BEGIN', 'COMMIT']);
    assert.deepStrictEqual(repo.annotations.get(kImage), { entityID: kImage, ...kEmpty, looksNude: 'nude', looksChild: 'child' });
    assert.deepStrictEqual(r.body as protocol.Annotation.Save.Response, { moment: { sensitive: true, sensitiveManual: false } });
    // 手で上書きした moment は変わらない。
    assert.strictEqual(repo.moments[1].sensitive, false);
  });

  it("手で上書きした moment を開いているなら、上書きの値と sensitiveManual を返す", async () => {
    const { save } = setup();
    const r = await save(request({ looksNude: 'nude', looksChild: 'child' }, formatMomentTime(kManual)));
    assert.deepStrictEqual(r.body, { moment: { sensitive: false, sensitiveManual: true } });
  });

  it("新規の moment（originalDate が null か無い）や、無い moment なら moment を返さない", async () => {
    const { save } = setup();
    assert.deepStrictEqual((await save(request({}, null))).body, {});
    const { originalDate: _, ...withoutDate } = request({});
    assert.deepStrictEqual((await save(withoutDate)).body, {});
    assert.deepStrictEqual((await save(request({}, '2000/01/01 00:00:00'))).body, {});
  });

  it("空の文字列と空のリストは、null に変えずにそのまま書く", async () => {
    const { repo, save } = setup();
    await save(request({ alt: '', tags: [], characters: ['a'] }));
    const a = repo.annotations.get(kImage)!!;
    assert.deepStrictEqual([a.alt, a.tags, a.characters, a.description], ['', [], ['a'], null]);
  });

  const invalid: [string, unknown][] = [
    ['alt が数', request({ alt: 1 as any })],
    ['tags が文字列', request({ tags: 'a,b' as any })],
    ['checked が null', request({ checked: null as any })],
    ['roleStar が文字列', request({ roleStar: 'true' as any })],
    ['medium が定義に無い', request({ medium: 'oil' as any })],
    ['項目が欠けている', { ...request({}), annotation: (({ alt: _, ...rest }) => rest)(kEmpty) }],
    ['定義に無い項目がある', { ...request({}), annotation: { ...kEmpty, looks_nude: 'nude' } }],
    ['annotation が無い', { entityID: kImage, originalDate: null }],
    ['entityID の形が違う', { ...request({}), entityID: 'img' }],
    ['originalDate が日時でない', request({}, 'yesterday')],
    ['本文が無い', null],
  ];
  for (const [name, body] of invalid) {
    it(`${name}なら 400 で、何も書かない`, async () => {
      const { repo, save } = setup();
      const r = await save(body);
      assert.strictEqual(r.statusCode, 400, JSON.stringify(r.body));
      assert.ok(typeof r.body.message === 'string' && r.body.message.length > 0);
      assert.deepStrictEqual(repo.log, []);
      assert.strictEqual(repo.annotations.size, 0);
    });
  }

  it("その種類が持たない項目を送ると例外になり、何も書かない", async () => {
    const { repo, save } = setup();
    await assert.rejects(() => save({ ...request({ looksNude: 'none' }), entityID: kAudio }), /cannot have looksNude/);
    assert.deepStrictEqual(repo.log, ['BEGIN', 'ROLLBACK']);
    assert.strictEqual(repo.annotations.size, 0);
  });

  it("無い entity の注釈は例外になる", async () => {
    const { repo, save } = setup();
    await assert.rejects(() => save({ ...request({}), entityID: kMissing }), /Entity not found/);
    assert.strictEqual(repo.annotations.size, 0);
  });
});
