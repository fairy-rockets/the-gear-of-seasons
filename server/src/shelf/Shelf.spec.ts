import { describe, it } from 'mocha';
import assert from 'assert';
import dayjs from 'dayjs';

import Repo from '../repo/Repo.js';
import Shelf from './Shelf.js';
import { MomentVisibility } from './Moment.js';

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
