import Repo from '../repo/Repo.js';
import Shelf from '../shelf/Shelf.js';
import * as fml from '../lib/fml.js';
import { Entity } from '../shelf/Entity.js'

async function main() {
  console.log('** GC **');
  const repo = new Repo();
  const shelf = new Shelf(repo);
  const usedEntiry = new Set<string>();
  const entities = new Map<string, Entity>();
  let numMoments = 0;
  try {
    for await (let m of shelf.enumurateAllMoments()) {
      numMoments++;
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
    for await (let e of shelf.enumurateAllEntries()) {
      entities.set(e.id, e);
    }
    console.log(`Found ${numMoments} moments, ${entities.size} entities, ${usedEntiry.size} entities used.`);
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
