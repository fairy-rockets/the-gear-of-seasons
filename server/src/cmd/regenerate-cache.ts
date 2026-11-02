import Repo from '../repo/Repo.js';
import Shelf from '../shelf/Shelf.js';
import { Entity } from '../shelf/Entity.js'

// 引数に entity の ID を渡すと、その entity だけを作り直す。引数が無ければ全 entity を作り直す。
async function main(ids: string[]) {
  const started = performance.now();
  console.log('** Regenerating entity cache **');
  const repo = new Repo();
  const shelf = new Shelf(repo);
  const entities: Entity[] = [];
  let processed = 0;

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
    for (const entity of entities) {
      console.log(`[${entity.mimeType}] ${entity.id} (${processed+1}/${entities.length})`);
      const beg = performance.now();
      await shelf.regenerateEntityCache(entity);
      ++processed;
      const end = performance.now();
      console.log(` -> Done in ${((end-beg)/1000).toPrecision(2)}sec (total: ${((end-started)/1000).toPrecision(2)}sec)`);
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
