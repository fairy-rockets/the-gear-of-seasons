import Repo from '../repo/Repo.js';
import Shelf from '../shelf/Shelf.js';
import * as fml from '../lib/fml.js';
import { Entity } from '../shelf/Entity.js'

async function main() {
  console.log('** GC **');
  const repo = new Repo();
  const shelf = new Shelf(repo);
  const entities = new Map<string, Entity>();
  try {
    for await (const e of shelf.enumurateAllEntries()) {
      entities.set(e.id, e);
    }
    for (const [id, entity] of entities) {
      console.log(`Regenerating: ${id}`);
      await shelf.regenerateEntityCache(entity);
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
