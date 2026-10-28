import { describe, it } from 'mocha';
import assert from 'assert';
import dayjs from 'dayjs';

import Repo from '../repo/Repo.js';
import Shelf from './Shelf.js';
import { Entity } from './Entity.js';
import { EntityAnnotation } from './EntityAnnotation.js';
import { CuratedMoment, Moment, MomentVisibility } from './Moment.js';

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
  updateMomentCuration: '書き込みだけ',
  overrideMomentSensitive: '書き込みだけ',
  resetMomentSensitive: '書き込みのために引く。ura（編集側）からだけ使うので下書きも含める',
  computeSensitive: 'moment を引かない',
  findEntityAnnotation: 'moment を引かない',
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
    looksNude, looksChild, looksNote: null, checked: false, role: null, roleGroup: null, roleStar: null, roleNote: null,
  };
}

let numCurated = 0;
function curated(text: string, sensitiveManual: boolean, sensitive = false): CuratedMoment {
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
  // 実物はプールの接続が1本なので、外の repo を使うとエラーにならずに止まる（Pool.transaction）。
  private busy = false;
  readonly annotations = new Map<string, EntityAnnotation>();
  readonly autoSensitive: [string, boolean][] = [];
  readonly saved: unknown[][] = [];
  constructor(readonly entities: Entity[], readonly moments: CuratedMoment[]) {}
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
  async updateMomentSensitive(timestamp: dayjs.Dayjs, v: boolean, manual: boolean) {
    this.mustNotBeBusy('updateMomentSensitive');
    this.saved.push(['updateMomentSensitive', timestamp.toISOString(), v, manual]);
    return true;
  }
  async insertMoment(m: Moment, autoSensitive: boolean) {
    this.mustNotBeBusy('insertMoment');
    this.saved.push(['insertMoment', m, autoSensitive]);
  }
  async updateMoment(old: dayjs.Dayjs, m: Moment, autoSensitive: boolean) {
    this.mustNotBeBusy('updateMoment');
    this.saved.push(['updateMoment', old.toISOString(), m, autoSensitive]);
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
  const kReq = {
    title: 't',
    originalDate: '2020/01/02 03:04:05',
    date: '2020/01/02 03:04:05',
    author: 'a',
    text: `[image entity="${kA}"]`,
    status: 'published' as const,
  };

  it("キュレーションの項目を Repo に渡さず、本文から計算した sensitive を渡す", async () => {
    const repo = new FakeRepo([kImageA], []);
    repo.annotations.set(kA, annotation(kA, 'nude', 'child'));
    await new Shelf(repo as unknown as Repo).updateMoment(kReq);
    assert.strictEqual(repo.saved.length, 1);
    const [name, , m, autoSensitive] = repo.saved[0];
    assert.strictEqual(name, 'updateMoment');
    for (const key of ['tier', 'series', 'sensitive', 'sensitiveManual']) {
      assert.ok(!(key in (m as object)), key);
    }
    assert.strictEqual(autoSensitive, true);
  });

  it("新しい moment にも計算した sensitive を渡す", async () => {
    const repo = new FakeRepo([kImageA], []);
    await new Shelf(repo as unknown as Repo).updateMoment({ ...kReq, originalDate: null });
    assert.deepStrictEqual(repo.saved.map((s) => [s[0], s[2]]), [['insertMoment', false]]);
  });
});

describe("Shelf.resetMomentSensitive", () => {
  it("手での上書きを外し、計算し直した値を書く", async () => {
    const m = curated(`[image entity="${kA}"]`, true, false);
    const repo = new FakeRepo([kImageA], [m]);
    repo.annotations.set(kA, annotation(kA, 'nude', 'child'));
    await new Shelf(repo as unknown as Repo).resetMomentSensitive(m.timestamp!!);
    assert.deepStrictEqual(repo.log, ['BEGIN', 'COMMIT']);
    assert.deepStrictEqual(repo.saved, [['updateMomentSensitive', m.timestamp!!.toISOString(), true, false]]);
  });
});
