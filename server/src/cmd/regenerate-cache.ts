import Repo from '../repo/Repo.js';
import Shelf from '../shelf/Shelf.js';
import { Entity } from '../shelf/Entity.js'
import { entityKind } from './lib/entity.js';

// 引数に entity の ID を渡すと、その entity だけを作り直す。引数が無ければ全 entity を作り直す。
// 1件の失敗（original が無い、外部の動画を取り直せない）では止めず、理由を出して残りを続け、
// 最後に失敗の件数を出す。失敗があれば終了コードを 1 にする。
async function main(ids: string[]) {
  const started = performance.now();
  console.log('** Regenerating entity cache **');
  const repo = new Repo();
  const shelf = new Shelf(repo);
  const entities: Entity[] = [];
  let processed = 0;
  const failed: string[] = [];

  try {
    if (ids.length > 0) {
      // 1件でも見つからなければ、何も作り直さずに止める。
      for (const id of ids) {
        const e = await shelf.findEntity(id);
        if (e === null) {
          throw new Error(`Entity not found: ${id}`);
        }
        entities.push(e);
      }
    } else {
      for await (const e of shelf.enumurateAllEntities()) {
        entities.push(e);
      }
    }
    for (const [i, entity] of entities.entries()) {
      console.log(`[${entityKind(entity)}] ${entity.id} (${i+1}/${entities.length})`);
      const beg = performance.now();
      try {
        await shelf.regenerateEntityCache(entity);
      } catch (err) {
        // 理由は message だけを出す。
        const reason = err instanceof Error ? err.message : String(err);
        console.error(` -> Failed: ${entity.id}: ${reason}`);
        failed.push(entity.id);
        continue;
      }
      ++processed;
      const end = performance.now();
      console.log(` -> Done in ${((end-beg)/1000).toPrecision(2)}sec (total: ${((end-started)/1000).toPrecision(2)}sec)`);
    }
    console.log(`** ${processed} regenerated, ${failed.length} failed **`);
    if (failed.length > 0) {
      console.error(`Failed entities:\n${failed.map((id) => `  - ${id}`).join('\n')}`);
      process.exitCode = 1;
    }
  } finally {
    await repo.close();
    // 動いているサーバーは entity を期限なしでキャッシュしていて、このプロセスからは消せない。
    // 途中で失敗しても、それまでに作り直した entity があれば伝える。
    if (processed > 0) {
      console.log('** Restart the app container: the running server keeps the old entities cached **');
    }
  }
}

main(process.argv.slice(2))
  .then(() => {})
  .catch((err) => {
    console.error(err);
    throw err;
  });
