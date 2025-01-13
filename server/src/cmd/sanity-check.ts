import * as fs from 'fs/promises';

import Repo from '../repo/Repo.js';
import Shelf from '../shelf/Shelf.js';
import { Moment, formatMomentPath } from '../shelf/Moment.js';
import * as fml from '../lib/fml.js';

const repo = new Repo();
const shelf = new Shelf(repo);

async function findMoment(entityId: string): Promise<Set<Moment>> {
  const set = new Set<Moment>();
  for await(const moment of repo.enumurateAllMoments()) {
    const content = fml.parse(moment.text);
    for (const block of content.blocks) {
      if (block.type === 'audio' || block.type === 'image' || block.type === 'video') {
        if(!block.entity) {
          continue;
        }
        if (block.entity === entityId) {
          set.add(moment);
        }
      }
    }
  }
  return set;
}

async function main() {
  console.log('** Starting Sanity Check **');
  console.log();
  try {
    console.log('[Checking all moments...]')
    for await(let entity of shelf.enumurateAllEntities()) {
      let files = await shelf.resolveFilepaths(entity);
      for (const file of files) {
        try {
          await fs.lstat(file);
        } catch (err) {
          const moments = await findMoment(entity.id);
          console.log(`Not found: ${entity.id}`);
          for (const moment of moments) {
            if (moment.timestamp === undefined) {
              continue;
            }
            const path = formatMomentPath(moment.timestamp);
            console.log(`  - https://ura.hexe.net${path}`);
          }
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
