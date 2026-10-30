import { describe, it } from 'mocha';
import assert from 'assert';
import dayjs from 'dayjs';

import * as protocol from '../lib/protocol.js';
import Repo from '../repo/Repo.js';
import Shelf from './Shelf.js';
import { Entity } from './Entity.js';
import { EntityAnnotation } from './EntityAnnotation.js';
import { Moment, MomentVisibility, parseMomentTime } from './Moment.js';

// Shelf は Repo への受け渡しだけなので、Repo をスタブにして
// 受け取った MomentVisibility がそのまま Repo に渡ることを見る。

// moment を引くメソッドのうち、MomentVisibility を取るもの。
const kVisibilityAware: { [name: string]: (shelf: Shelf, v: MomentVisibility) => Promise<unknown> } = {
  findMoment: (shelf, v) => shelf.findMoment(dayjs(), v),
  findPreviousMomentSummary: (shelf, v) => shelf.findPreviousMomentSummary(dayjs(), v),
  findNextMomentSummary: (shelf, v) => shelf.findNextMomentSummary(dayjs(), v),
  findMomentSummariesByRandom: (shelf, v) => shelf.findMomentSummariesByRandom(10, v),
  findAllMomentSummaries: (shelf, v) => shelf.findAllMomentSummaries(v),
  findMomentSummariesInYear: (shelf, v) => shelf.findMomentSummariesInYear(2020, v),
};

// MomentVisibility を取らないことが決まっているもの。理由もここに書く。
const kWithoutVisibility: { [name: string]: string } = {
  enumurateAllEntities: 'moment を引かない',
  findEntity: 'moment を引かない',
  resolveEntityPath: 'moment を引かない',
  insertEntity: 'moment を引かない',
  deleteEntity: 'moment を引かない',
  regenerateEntityCache: 'moment を引かない',
  resolveFilepaths: 'moment を引かない',
  updateMoment: '書き込みだけ',
  makeMomentFromRequest: '書き込みのための組み立て。moment は引かない',
  enumurateAllMoments: 'gc などが使用中の entity を数える。下書きも含めて全件',
  deleteMoment: '書き込みだけ',
  computeSensitive: 'moment を引かない',
  findEntityAnnotation: 'moment を引かない',
  findEntityAnnotations: 'moment を引かない',
  saveEntityAnnotation: '書き込みのために引く。下書きも含めて計算し直す',
};

function stubRepo(): { repo: Repo, received: unknown[][] } {
  const received: unknown[][] = [];
  const repo = new Proxy({}, {
    get: (_target, _name) => async (...args: unknown[]) => {
      received.push(args);
      return null;
    },
  });
  return { repo: repo as Repo, received };
}

describe("Shelf のメソッド", () => {
  // 名前によらず、Shelf のメソッドはすべてどちらかに分類する。
  it("MomentVisibility の扱いがすべて決まっている", () => {
    const names = Object.getOwnPropertyNames(Shelf.prototype).filter((n) => n !== 'constructor');
    assert.ok(names.length > 0);
    for (const name of names) {
      assert.ok(name in kVisibilityAware || name in kWithoutVisibility, `${name} の MomentVisibility が未分類`);
    }
  });
  it("両方に分類されているメソッドは無い", () => {
    for (const name of Object.keys(kVisibilityAware)) {
      assert.ok(!(name in kWithoutVisibility), name);
    }
  });

  for (const [name, call] of Object.entries(kVisibilityAware)) {
    for (const v of ['published', 'all'] as MomentVisibility[]) {
      it(`${name}('${v}') は Repo にそのまま渡す`, async () => {
        const { repo, received } = stubRepo();
        await call(new Shelf(repo), v);
        assert.strictEqual(received.length, 1);
        const args = received[0];
        assert.strictEqual(args[args.length - 1], v);
      });
    }
  }
});

// キュレーションの項目と sensitive の扱いを、DB の代わりに配列で持つ Repo で見る。
const kA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const kB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function annotation(entityID: string, looksNude: EntityAnnotation['looksNude'], looksChild: EntityAnnotation['looksChild']): EntityAnnotation {
  return {
    entityID, medium: null, alt: null, description: null, tags: null, palette: null, characters: null,
    looksNude, looksChild, looksNote: null, humanVerified: false, role: null, roleGroup: null, roleStar: null, roleNote: null,
  };
}

let numCurated = 0;
function curated(text: string, sensitiveManual: boolean, sensitive = false): Moment {
  numCurated++;
  return {
    timestamp: dayjs('2020-01-02T03:04:05+09:00').add(numCurated, 'day'),
    title: 't', author: 'a', text, iconID: undefined, status: 'draft',
    tier: 'pickup', series: ['癒し'], sensitive, sensitiveManual,
  };
}

class FakeRepo {
  readonly log: string[] = [];
  private inTransaction = false;
  // トランザクションの最中か。最中に tx ではなく外の repo を使ったら失敗させる。
  // 実物では、外の repo のクエリはエラーにならずにトランザクションの外で流れてしまう（Pool.transaction）。
  private busy = false;
  readonly annotations = new Map<string, EntityAnnotation>();
  readonly autoSensitive: [string, boolean][] = [];
  readonly saved: unknown[][] = [];
  constructor(readonly entities: Entity[], readonly moments: Moment[]) {}
  private mustBeInTransaction(name: string) {
    assert.ok(this.inTransaction, `${name} がトランザクションの外で呼ばれた`);
  }
  private mustNotBeBusy(name: string) {
    assert.ok(!this.busy, `${name} がトランザクションの最中に、tx ではなく外の repo で呼ばれた`);
  }
  async transaction<T>(fn: (tx: Repo) => Promise<T>): Promise<T> {
    // 入れ子は外のトランザクションに加わる（実物と同じ）。
    if (this.inTransaction) {
      return await fn(this as unknown as Repo);
    }
    this.mustNotBeBusy('transaction');
    // tx は this を prototype にした別のオブジェクト。配列や Map は this と共有する。
    const tx: FakeRepo = Object.create(this);
    tx.inTransaction = true;
    tx.busy = false;
    this.busy = true;
    this.log.push('BEGIN');
    try {
      const r = await fn(tx as unknown as Repo);
      this.log.push('COMMIT');
      return r;
    } catch (err) {
      this.log.push('ROLLBACK');
      throw err;
    } finally {
      this.busy = false;
    }
  }
  async findEntity(id: string) {
    this.mustNotBeBusy('findEntity');
    return this.entities.find((e) => e.id === id) ?? null;
  }
  async findMoment(timestamp: dayjs.Dayjs, _v: MomentVisibility) {
    this.mustNotBeBusy('findMoment');
    return this.moments.find((m) => m.timestamp!!.isSame(timestamp)) ?? null;
  }
  async findEntityAnnotations(ids: string[]) {
    this.mustNotBeBusy('findEntityAnnotations');
    return new Map([...this.annotations].filter(([id]) => ids.includes(id)));
  }
  async upsertEntityAnnotation(a: EntityAnnotation) {
    this.mustNotBeBusy('upsertEntityAnnotation');
    this.mustBeInTransaction('upsertEntityAnnotation');
    this.annotations.set(a.entityID, a);
  }
  async findAutoSensitiveMomentCandidates(id: string) {
    this.mustNotBeBusy('findAutoSensitiveMomentCandidates');
    this.mustBeInTransaction('findAutoSensitiveMomentCandidates');
    return this.moments.filter((m) => !m.sensitiveManual && m.text.includes(id));
  }
  async updateMomentAutoSensitive(timestamp: dayjs.Dayjs, v: boolean) {
    this.mustNotBeBusy('updateMomentAutoSensitive');
    this.mustBeInTransaction('updateMomentAutoSensitive');
    this.autoSensitive.push([timestamp.toISOString(), v]);
  }
  async insertMoment(m: Moment) {
    this.mustNotBeBusy('insertMoment');
    this.mustBeInTransaction('insertMoment');
    this.saved.push(['insertMoment', m]);
  }
  // 実物と同じく、old の moment が無ければ false。
  async updateMoment(old: dayjs.Dayjs, m: Moment) {
    this.mustNotBeBusy('updateMoment');
    this.mustBeInTransaction('updateMoment');
    if (!this.moments.some((e) => e.timestamp!!.isSame(old))) {
      return false;
    }
    this.saved.push(['updateMoment', old.toISOString(), m]);
    return true;
  }
}

const kImageA: Entity = {
  type: 'image', id: kA, mediumID: 'm', iconID: 'i', timestamp: undefined, mimeType: 'image/png', width: 1, height: 1,
};
const kAudioB: Entity = {
  type: 'audio', id: kB, iconID: 'i', timestamp: undefined, mimeType: 'audio/mpeg', duration: 1,
};

describe("Shelf.saveEntityAnnotation", () => {
  it("同じトランザクションで、その entity を使う自動の moment の sensitive を計算し直す", async () => {
    const uses = curated(`[image entity="${kA}"]`, false);
    const audioOnly = curated(`[audio entity="${kA}"]`, false);
    const mentions = curated(`${kA} という文字列だけ`, false);
    const repo = new FakeRepo([kImageA], [uses, audioOnly, mentions]);
    await new Shelf(repo as unknown as Repo).saveEntityAnnotation(annotation(kA, 'nude', 'child'));
    assert.deepStrictEqual(repo.log, ['BEGIN', 'COMMIT']);
    assert.deepStrictEqual(repo.autoSensitive, [[uses.timestamp!!.toISOString(), true]]);
  });

  it("本文のほかの entity の注釈も合わせて計算する", async () => {
    const m = curated(`[image entity="${kA}"][video entity="${kB}"]`, false);
    const repo = new FakeRepo([kImageA], [m]);
    repo.annotations.set(kB, annotation(kB, 'nude', 'child'));
    await new Shelf(repo as unknown as Repo).saveEntityAnnotation(annotation(kA, 'none', 'none'));
    assert.deepStrictEqual(repo.autoSensitive, [[m.timestamp!!.toISOString(), true]]);
  });

  it("手で上書きした moment は計算し直さない", async () => {
    const m = curated(`[image entity="${kA}"]`, true);
    const repo = new FakeRepo([kImageA], [m]);
    await new Shelf(repo as unknown as Repo).saveEntityAnnotation(annotation(kA, 'nude', 'child'));
    assert.deepStrictEqual(repo.autoSensitive, []);
  });

  it("種類に合わない項目があれば、何も書かずに例外にする", async () => {
    const repo = new FakeRepo([kAudioB], []);
    await assert.rejects(
      () => new Shelf(repo as unknown as Repo).saveEntityAnnotation(annotation(kB, 'none', null)),
      /cannot have looksNude/);
    assert.deepStrictEqual(repo.log, ['BEGIN', 'ROLLBACK']);
    assert.strictEqual(repo.annotations.size, 0);
  });

  it("無い entity の注釈は例外にする", async () => {
    const repo = new FakeRepo([], []);
    await assert.rejects(
      () => new Shelf(repo as unknown as Repo).saveEntityAnnotation(annotation(kA, null, null)),
      /Entity not found/);
  });
});

describe("Shelf.updateMoment（SAVE）", () => {
  const kOld = parseMomentTime('2020/01/02 03:04:05');
  const kReq: protocol.Moment.Save.Request = {
    title: 't',
    originalDate: '2020/01/02 03:04:05',
    date: '2020/01/02 03:04:06',
    author: 'a',
    text: `[image entity="${kA}"]`,
    status: 'published',
    tier: 'sketch',
    series: ['魔女hexe', '癒し'],
    sensitiveOverride: null,
  };
  // kOld にある moment を持ち、kA に nude・child の注釈がある（自動なら sensitive = true）。
  function repoWithMoment(): FakeRepo {
    const repo = new FakeRepo([kImageA], [{ ...curated('', false), timestamp: kOld }]);
    repo.annotations.set(kA, annotation(kA, 'nude', 'child'));
    return repo;
  }

  it("Save.Request のすべての項目を、1つのトランザクションで Repo に渡す", async () => {
    const repo = repoWithMoment();
    await new Shelf(repo as unknown as Repo).updateMoment(kReq);
    assert.deepStrictEqual(repo.log, ['BEGIN', 'COMMIT']);
    assert.deepStrictEqual(repo.saved, [['updateMoment', kOld.toISOString(), {
      timestamp: parseMomentTime('2020/01/02 03:04:06'),
      title: 't',
      author: 'a',
      text: `[image entity="${kA}"]`,
      iconID: kA,
      status: 'published',
      tier: 'sketch',
      series: ['魔女hexe', '癒し'],
      sensitive: true,
      sensitiveManual: false,
    }]]);
  });

  it("sensitiveOverride が true / false なら、その値を手での上書きとして書く", async () => {
    for (const v of [true, false]) {
      const repo = repoWithMoment();
      const m = await new Shelf(repo as unknown as Repo).updateMoment({ ...kReq, sensitiveOverride: v });
      assert.deepStrictEqual([m.sensitive, m.sensitiveManual], [v, true]);
      const saved = repo.saved[0][2] as Moment;
      assert.deepStrictEqual([saved.sensitive, saved.sensitiveManual], [v, true]);
    }
  });

  it("sensitiveOverride が null なら、上書きを外して本文と注釈から計算した値に戻す", async () => {
    const repo = repoWithMoment();
    repo.moments[0].sensitive = false;
    repo.moments[0].sensitiveManual = true;
    const m = await new Shelf(repo as unknown as Repo).updateMoment({ ...kReq, sensitiveOverride: null });
    assert.deepStrictEqual([m.sensitive, m.sensitiveManual], [true, false]);
  });

  it("新しい moment は insertMoment で書く。新規の画面の既定値（archive・空・自動）もそのまま書く", async () => {
    const repo = new FakeRepo([kImageA], []);
    await new Shelf(repo as unknown as Repo).updateMoment({
      ...kReq, originalDate: null, tier: 'archive', series: [], sensitiveOverride: null,
    });
    assert.deepStrictEqual(repo.log, ['BEGIN', 'COMMIT']);
    assert.strictEqual(repo.saved.length, 1);
    const [name, m] = repo.saved[0] as [string, Moment];
    assert.strictEqual(name, 'insertMoment');
    assert.deepStrictEqual([m.tier, m.series, m.sensitive, m.sensitiveManual], ['archive', [], false, false]);
  });

  it("日時が空なら、トランザクションの外で画像の撮影日時を引いて使う", async () => {
    const t = dayjs('2019-05-06T07:08:09+09:00');
    const repo = new FakeRepo([{ ...kImageA, timestamp: t }], []);
    const m = await new Shelf(repo as unknown as Repo).updateMoment({ ...kReq, originalDate: null, date: null });
    assert.ok(m.timestamp!!.isSame(t));
    assert.deepStrictEqual(repo.saved.map((s) => s[0]), ['insertMoment']);
  });

  it("書き換える moment が無ければ例外にする", async () => {
    const repo = new FakeRepo([kImageA], []);
    await assert.rejects(() => new Shelf(repo as unknown as Repo).updateMoment(kReq), /Moment not found/);
    assert.deepStrictEqual(repo.log, ['BEGIN', 'ROLLBACK']);
  });

  // 古いクライアントからの保存で、キュレーションの項目が黙って変わらないように。
  for (const key of ['status', 'tier', 'series', 'sensitiveOverride']) {
    it(`${key} が欠けていれば、何も書かずに例外にする`, async () => {
      const repo = repoWithMoment();
      const req: Record<string, unknown> = { ...kReq };
      delete req[key];
      await assert.rejects(() => new Shelf(repo as unknown as Repo).updateMoment(req as protocol.Moment.Save.Request), /Invalid/);
      assert.deepStrictEqual(repo.saved, []);
    });
  }

  for (const [key, value] of [['tier', 'featured'], ['series', '魔女hexe, 癒し'], ['series', [1]], ['sensitiveOverride', 'auto']] as [string, unknown][]) {
    it(`${key} が ${JSON.stringify(value)} なら、何も書かずに例外にする`, async () => {
      const repo = repoWithMoment();
      const req = { ...kReq, [key]: value } as protocol.Moment.Save.Request;
      await assert.rejects(() => new Shelf(repo as unknown as Repo).updateMoment(req), /Invalid/);
      assert.deepStrictEqual(repo.saved, []);
    });
  }
});
