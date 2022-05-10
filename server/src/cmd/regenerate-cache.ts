import Repo from '../repo/Repo.js';
import Shelf from '../shelf/Shelf.js';
import { Entity } from '../shelf/Entity.js'

async function main() {
  console.log('** Regenerating entity cache **');
  const repo = new Repo();
  const shelf = new Shelf(repo);
  const entities: Entity[] = []; 

  try {
    for await (const e of shelf.enumurateAllEntries()) {
      entities.push(e);
    }
    let processed = 0;
    for (const entity of entities) {
      console.log(`[${entity.mimeType}] ${entity.id} (${processed+1}/${entities.length})`);
      const beg = performance.now();
      await shelf.regenerateEntityCache(entity);
      ++processed;
      const end = performance.now();
      console.log(` -> Done: ${((end-beg)/1000).toPrecision(2)}sec elapsed.`);
    }
  } finally {
    await repo.close();
  }
}

main()
  .then(() => {})
  .catch((err) => {
    console.error(err);
    throw err;
  });
