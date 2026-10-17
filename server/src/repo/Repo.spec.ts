import { describe, it, beforeEach } from 'mocha';
import assert from 'assert';
import dayjs from 'dayjs';

import Repo, { momentVisibilityCondition } from './Repo.js';
import { Moment, MomentVisibility } from '../shelf/Moment.js';

// DB には繋がず、Repo が組み立てる SQL と引数だけを見る。
// （Pool は最初の query までは接続しないので、new Repo() しても DB は要らない）
type Call = { q: string, args: any[] };

function stubPool(repo: Repo, rows: Record<string, unknown>[]): Call[] {
  const calls: Call[] = [];
  (repo as any).pool = {
    query: async (q: string, args: any[]) => {
      calls.push({ q, args });
      return (async function* () {
        yield* rows;
      })();
    },
    close: async () => {},
  };
  return calls;
}

const kRow = {
  timestamp: new Date('2020-01-02T03:04:05+09:00'),
  title: 't',
  author: 'a',
  text: 'x',
  icon_id: null,
  status: 'draft',
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

// visibility を取らないことが決まっているもの。
const kNotFiltered = new Set([
  'enumurateAllMoments', // gc などが使う。下書きも含めて全件
  'insertMoment',
  'updateMoment',
  'deleteMoment',
]);

describe("Repo の moment を扱うメソッド", () => {
  // visibility を取らない新しい読み出しを足すと、ここで落ちる。
  // omote から使うなら visibility を取らせて kVisibilityAware に足す。
  it("visibility の扱いがすべて決まっている", () => {
    const names = Object.getOwnPropertyNames(Repo.prototype).filter((n) => /Moment/.test(n));
    assert.ok(names.length > 0);
    for (const name of names) {
      assert.ok(name in kVisibilityAware || kNotFiltered.has(name), `${name} の visibility が未分類`);
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
