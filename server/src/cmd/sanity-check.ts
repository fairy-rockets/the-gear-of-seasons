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
    console.log('Analyzing...')
    let numMissingEntity = 0;
    const map = new Map<string, Set<string>>();
    for await(let entity of shelf.enumurateAllEntities()) {
      const files = await shelf.resolveFilepaths(entity);
      for (const file of files) {
        try {
          await fs.lstat(file);
        } catch (err) {
          const moments = await findMoment(entity.id);
          for (const moment of moments) {
            if (moment.timestamp === undefined) {
              continue;
            }
            const path = formatMomentPath(moment.timestamp);
            if (!map.has(path)) {
              map.set(path, new Set<string>());
            }
            const set = map.get(path)!;
            set.add(entity.id);
	    numMissingEntity++;
          }
        }
      }
    }
    console.log(`Missing files in ${map.size} moments, ${numMissingEntity} entities.`);
    const paths = [...map.keys()].sort();
    for (const path of paths) {
      const set = map.get(path)!;
      console.log(`https://ura.hexe.net${path}`);
      for (const id of set) {
        console.log(`  - ${id}`);
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
