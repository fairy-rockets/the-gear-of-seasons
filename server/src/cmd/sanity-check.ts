import * as fs from 'fs/promises';

import Repo from '../repo/Repo.js';
import Shelf from '../shelf/Shelf.js';

async function main() {
  console.log('** Starting Sanity Check **');
  console.log();
  const repo = new Repo();
  const shelf = new Shelf(repo);
  try {
    console.log('[Checking all moments...]')
    for await(let entity of shelf.enumurateAllEntities()) {
      let files = await shelf.resolveFilepaths(entity);
      for (const file of files) {
        try {
          await fs.lstat(file);
        } catch (err) {
          console.log(`${entity.id}, ${file}`);
        }
      }
    }
    console.log();
    console.log('All done!');
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
