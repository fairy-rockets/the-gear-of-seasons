import Repo from '../repo/Repo.js';
import Shelf from '../shelf/Shelf.js';
import * as fml from '../lib/fml.js';

async function main() {
  console.log('** GC **');
  const repo = new Repo();
  const shelf = new Shelf(repo);
  const usedEntiry = new Set<string>();
  try {
    for await (let m of shelf.enumAllMoments()) {
      for (let block of fml.parse(m.text).blocks) {
        switch (block.type) {
          case "image": {
            if (block.entity != undefined) {
              usedEntiry.add(block.entity);
            }
            break;
          }
          case "video": {
            if (block.entity != undefined) {
              usedEntiry.add(block.entity);
            }
            break;
          }
          case "audio": {
            if (block.entity != undefined) {
              usedEntiry.add(block.entity);
            }
            break;
          }
          case "text":
          case "link":
          case "markdown":
          default:
            break;
        }
      }
    }
    console.log(`Found ${usedEntiry.size} used entities.`);
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
