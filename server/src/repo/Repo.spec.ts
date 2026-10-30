import { describe, it, beforeEach } from 'mocha';
import assert from 'assert';
import dayjs from 'dayjs';

import Repo, { momentVisibilityCondition } from './Repo.js';
import { EntityAnnotation } from '../shelf/EntityAnnotation.js';
import { Moment, MomentVisibility } from '../shelf/Moment.js';

// DB には繋がず、Repo が組み立てる SQL と引数だけを見る。
// （Pool は最初の query までは接続しないので、new Repo() しても DB は要らない）
// トランザクションは、BEGIN と COMMIT を calls に記録するだけ。
type Call = { q: string, args: any[] };

function stubPool(repo: Repo, rows: Record<string, unknown>[]): Call[] {
  const calls: Call[] = [];
  const pool = {
    query: async (q: string, args: any[]) => {
      calls.push({ q, args });
      return { rows, rowCount: rows.length };
    },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      calls.push({ q: 'BEGIN', args: [] });
      const r = await fn(pool);
      calls.push({ q: 'COMMIT', args: [] });
      return r;
    },
    close: async () => {},
  };
  (repo as any).pool = pool;
  return calls;
}

const kRow = {
  timestamp: new Date('2020-01-02T03:04:05+09:00'),
  title: 't',
  author: 'a',
  text: 'x',
  icon_id: null,
  status: 'draft',
  tier: 'archive',
  series: [],
  sensitive: false,
  sensitive_manual: false,
};

const kPublishedOnly = `"status" = 'published'`;

// moment を引くメソッドのうち、visibility を取るもの。
// omote から使うクエリを足したら、ここにも足す。
const kVisibilityAware: { [name: string]: (repo: Repo, v: MomentVisibility) => Promise<unknown> } = {
  findMoment: (repo, v) => repo.findMoment(dayjs(), v),
  findPreviousMomentSummary: (repo, v) => repo.findPreviousMomentSummary(dayjs(), v),
  findNextMomentSummary: (repo, v) => repo.findNextMomentSummary(dayjs(), v),
  findMomentSummariesByRandom: (repo, v) => repo.findMomentSummariesByRandom(10, v),
  findAllMomentSummaries: (repo, v) => repo.findAllMomentSummaries(v),
  findMomentSummariesInYear: (repo, v) => repo.findMomentSummariesInYear(2020, v),
};

// MomentVisibility を取らないことが決まっているもの。理由もここに書く。
const kWithoutVisibility: { [name: string]: string } = {
  close: 'moment を引かない',
  enumurateAllEntities: 'moment を引かない',
  findEntity: 'moment を引かない',
  insertEntity: 'moment を引かない',
  deleteEntity: 'moment を引かない',
  updateEntity: 'moment を引かない',
  enumurateAllMoments: 'gc などが使用中の entity を数える。下書きも含めて全件',
  insertMoment: '書き込みだけ',
  updateMoment: '書き込みだけ',
  deleteMoment: '書き込みだけ',
  transaction: 'moment を引かない',
  updateMomentAutoSensitive: '書き込みだけ',
  findAutoSensitiveMomentCandidates: '注釈の保存で sensitive を計算し直す対象。下書きも含めて全件',
  findEntityAnnotation: 'moment を引かない',
  findEntityAnnotations: 'moment を引かない',
  upsertEntityAnnotation: 'moment を引かない',
};

describe("Repo のメソッド", () => {
  // 名前によらず、Repo のメソッドはすべてどちらかに分類する。
  // 新しいメソッドを足すとここで落ちる。moment を引くなら MomentVisibility を取らせて
  // kVisibilityAware に、引かないなら理由を添えて kWithoutVisibility に足す。
  it("MomentVisibility の扱いがすべて決まっている", () => {
    const names = Object.getOwnPropertyNames(Repo.prototype).filter((n) => n !== 'constructor');
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
});

describe("momentVisibilityCondition", () => {
  it("published は公開済みだけに絞る", () => {
    assert.strictEqual(momentVisibilityCondition('published'), kPublishedOnly);
  });
  it("all は絞らない", () => {
    assert.strictEqual(momentVisibilityCondition('all'), 'true');
  });
});

describe("Repo の moment の可視性", () => {
  let repo: Repo;
  let calls: Call[];
  beforeEach(() => {
    repo = new Repo();
    calls = stubPool(repo, [kRow]);
  });

  for (const [name, call] of Object.entries(kVisibilityAware)) {
    it(`${name}('published') は公開済みだけを引く`, async () => {
      await call(repo, 'published');
      assert.strictEqual(calls.length, 1);
      assert.ok(calls[0].q.includes(kPublishedOnly), calls[0].q);
    });
    it(`${name}('all') は下書きも引く`, async () => {
      await call(repo, 'all');
      assert.strictEqual(calls.length, 1);
      assert.ok(!calls[0].q.includes(kPublishedOnly), calls[0].q);
    });
    it(`${name} は status を読む`, async () => {
      await call(repo, 'all');
      assert.ok(calls[0].q.includes(`"status"`), calls[0].q);
    });
  }

  // gc / list-missing はこれで使用中の entity を数える。下書きを落とすと、
  // 下書きが使っているメディアが消される。
  it("enumurateAllMoments は下書きも含めて全件を返す", async () => {
    const got: Moment[] = [];
    for await (const m of repo.enumurateAllMoments()) {
      got.push(m);
    }
    assert.strictEqual(calls.length, 1);
    assert.ok(!calls[0].q.includes(kPublishedOnly), calls[0].q);
    assert.ok(!/\bwhere\b/i.test(calls[0].q), calls[0].q);
    assert.deepStrictEqual(got.map((m) => m.status), ['draft']);
  });

  it("読んだ status を moment に載せる", async () => {
    const m = await repo.findMoment(dayjs(), 'all');
    assert.strictEqual(m?.status, 'draft');
  });

  it("DB に知らない status があれば例外にする", async () => {
    calls = stubPool(repo, [{ ...kRow, status: 'unlisted' }]);
    await assert.rejects(() => repo.findMoment(dayjs(), 'all'), /Invalid moment status/);
  });

  const kMoment: Moment = {
    timestamp: dayjs('2020-01-02T03:04:05+09:00'),
    title: 't',
    author: 'a',
    text: 'x',
    iconID: undefined,
    status: 'published',
    tier: 'archive',
    series: [],
    sensitive: false,
    sensitiveManual: false,
  };

  it("insertMoment は status を明示して渡す", async () => {
    await repo.insertMoment({ ...kMoment, status: 'draft' });
    assert.ok(calls[0].q.includes(`"status"`), calls[0].q);
    assert.ok(calls[0].args.includes('draft'), JSON.stringify(calls[0].args));
  });

  it("updateMoment は status も書き換える", async () => {
    await repo.updateMoment(dayjs('2020-01-02T03:04:05+09:00'), kMoment);
    assert.ok(calls[0].q.includes(`"status" = $6`), calls[0].q);
    assert.strictEqual(calls[0].args[5], 'published');
  });
});

describe("Repo のキュレーションの項目", () => {
  let repo: Repo;
  let calls: Call[];
  beforeEach(() => {
    repo = new Repo();
    calls = stubPool(repo, [kRow]);
  });

  const kTimestamp = dayjs('2020-01-02T03:04:05+09:00');
  const kMoment: Moment = {
    timestamp: kTimestamp,
    title: 't',
    author: 'a',
    text: 'x',
    iconID: undefined,
    status: 'published',
    tier: 'archive',
    series: [],
    sensitive: false,
    sensitiveManual: false,
  };

  const kCurated: Moment = { ...kMoment, tier: 'sketch', series: ['魔女hexe'], sensitive: true, sensitiveManual: true };

  it("updateMoment（SAVE）はキュレーションの項目も Moment の値をそのまま書く", async () => {
    await repo.updateMoment(kTimestamp, kCurated);
    const q = calls[0].q;
    assert.ok(q.includes(`"tier" = $8`), q);
    assert.ok(q.includes(`"series" = $9::text[]`), q);
    assert.ok(q.includes(`"sensitive" = $10`), q);
    assert.ok(q.includes(`"sensitive_manual" = $11`), q);
    assert.ok(!q.includes('case'), q);
    assert.deepStrictEqual(calls[0].args.slice(6), [kTimestamp.toDate(), 'sketch', ['魔女hexe'], true, true]);
  });

  it("updateMoment は moment が無ければ false を返す", async () => {
    calls = stubPool(repo, []);
    assert.strictEqual(await repo.updateMoment(kTimestamp, kCurated), false);
  });

  it("insertMoment はキュレーションの項目も Moment の値をそのまま書く", async () => {
    await repo.insertMoment(kCurated);
    const q = calls[0].q;
    assert.ok(q.includes(`"tier", "series", "sensitive", "sensitive_manual"`), q);
    assert.ok(q.includes(`$8::text[]`), q);
    assert.deepStrictEqual(calls[0].args.slice(6), ['sketch', ['魔女hexe'], true, true]);
  });

  it("findMoment はキュレーションの項目も読む", async () => {
    calls = stubPool(repo, [{ ...kRow, tier: 'pickup', series: ['癒し', '季節'], sensitive: true, sensitive_manual: true }]);
    const m = await repo.findMoment(kTimestamp, 'all');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(m?.tier, 'pickup');
    assert.deepStrictEqual(m?.series, ['癒し', '季節']);
    assert.strictEqual(m?.sensitive, true);
    assert.strictEqual(m?.sensitiveManual, true);
  });

  it("DB に知らない tier があれば例外にする", async () => {
    calls = stubPool(repo, [{ ...kRow, tier: 'featured' }]);
    await assert.rejects(() => repo.findMoment(kTimestamp, 'all'), /Invalid moment tier/);
  });

  it("updateMomentAutoSensitive は手で上書きした moment と、値が変わらない moment には書かない", async () => {
    await repo.updateMomentAutoSensitive(kTimestamp, true);
    const q = calls[0].q;
    assert.ok(q.includes(`not "sensitive_manual"`), q);
    assert.ok(q.includes(`"sensitive" is distinct from $2`), q);
    assert.deepStrictEqual(calls[0].args, [kTimestamp.toDate(), true]);
  });

  it("findAutoSensitiveMomentCandidates は本文に id を含む、自動の moment を下書きも含めて探す", async () => {
    const got = await repo.findAutoSensitiveMomentCandidates('0123456789abcdef0123456789abcdef');
    const q = calls[0].q;
    assert.ok(q.includes(`"text" like '%' || $1::text || '%'`), q);
    assert.ok(q.includes(`not "sensitive_manual"`), q);
    assert.ok(!q.includes(kPublishedOnly), q);
    assert.deepStrictEqual(calls[0].args, ['0123456789abcdef0123456789abcdef']);
    assert.strictEqual(got.length, 1);
  });

  it("transaction の中の Repo は、pool のトランザクションにクエリを流す", async () => {
    await repo.transaction(async (tx) => {
      await tx.updateMomentAutoSensitive(kTimestamp, true);
    });
    assert.deepStrictEqual(calls.map((c) => c.q.trim().split(/\s+/)[0]), ['BEGIN', 'update', 'COMMIT']);
  });
});

describe("Repo の entity の注釈", () => {
  let repo: Repo;
  let calls: Call[];

  const kID = '0123456789abcdef0123456789abcdef';
  const kAnnotationRow = {
    entity_id: kID,
    medium: 'drawing',
    alt: null,
    description: null,
    tags: [],
    palette: null,
    characters: null,
    looks_nude: 'none',
    looks_child: 'child',
    looks_note: null,
    human_verified: true,
    role: null,
    role_group: null,
    role_star: null,
    role_note: null,
  };

  beforeEach(() => {
    repo = new Repo();
    calls = stubPool(repo, [kAnnotationRow]);
  });

  it("findEntityAnnotations は id の配列を1つの引数で渡す", async () => {
    await repo.findEntityAnnotations([kID, 'fedcba9876543210fedcba9876543210']);
    assert.strictEqual(calls.length, 1);
    assert.ok(calls[0].q.includes(`"entity_id" = any($1::text[])`), calls[0].q);
    assert.deepStrictEqual(calls[0].args, [[kID, 'fedcba9876543210fedcba9876543210']]);
  });

  it("findEntityAnnotations は id が無ければ DB を引かない", async () => {
    const got = await repo.findEntityAnnotations([]);
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(got.size, 0);
  });

  // NULL（値なし）と 'none'・空のリストは別の値
  it("読んだ注釈の null と 'none'・空のリストを区別する", async () => {
    const a = await repo.findEntityAnnotation(kID);
    assert.ok(a !== null);
    assert.strictEqual(a.medium, 'drawing');
    assert.deepStrictEqual(a.tags, []);
    assert.strictEqual(a.characters, null);
    assert.strictEqual(a.looksNude, 'none');
    assert.strictEqual(a.palette, null);
    assert.strictEqual(a.humanVerified, true);
    assert.strictEqual(a.roleStar, null);
  });

  it("DB に知らない値があれば例外にする", async () => {
    calls = stubPool(repo, [{ ...kAnnotationRow, looks_nude: 'maybe' }]);
    await assert.rejects(() => repo.findEntityAnnotation(kID), /Invalid looks_nude/);
  });

  it("upsertEntityAnnotation はすべての項目を、null も含めてそのまま渡す", async () => {
    const a: EntityAnnotation = {
      entityID: kID,
      medium: 'photo',
      alt: '海',
      description: null,
      tags: ['海', 'a,"b"'],
      palette: 'color',
      characters: [],
      looksNude: 'partial',
      looksChild: 'adult',
      looksNote: null,
      humanVerified: false,
      role: 'grab',
      roleGroup: null,
      roleStar: true,
      roleNote: null,
    };
    await repo.upsertEntityAnnotation(a);
    const q = calls[0].q;
    assert.ok(q.includes(`on conflict ("entity_id") do update set`), q);
    assert.deepStrictEqual(calls[0].args, [
      kID, 'photo', '海', null, ['海', 'a,"b"'], 'color', [], 'partial', 'adult', null, false, 'grab', null, true, null,
    ]);
  });
});
