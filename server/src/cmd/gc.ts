import readline from 'readline/promises';

import Repo from '../repo/Repo.js';
import Shelf from '../shelf/Shelf.js';
import * as fml from '../lib/fml.js';
import { Entity } from '../shelf/Entity.js'

async function main() {
  console.log('** Starting GC **');
  console.log();
  const repo = new Repo();
  const shelf = new Shelf(repo);
  const usedEntities = new Set<string>();
  const entities = new Map<string, Entity>();
  const terminal = readline.createInterface({
    'terminal': true,
    'input': process.stdin,
    'output': process.stdout,
  });
  let numMoments = 0;
  try {
    console.log('[Checking all moments...]')
    for await (const m of shelf.enumurateAllMoments()) {
      numMoments++;
      if ((numMoments % 100) === 0) {
        console.log('  ', `${numMoments} analyzed.`);
      }
      for (let block of fml.parse(m.text).blocks) {
        switch (block.type) {
          case 'image': {
            if (block.entity !== undefined) {
              usedEntities.add(block.entity);
            }
            break;
          }
          case 'video': {
            if (block.entity !== undefined) {
              usedEntities.add(block.entity);
            }
            break;
          }
          case 'audio': {
            if (block.entity !== undefined) {
              usedEntities.add(block.entity);
            }
            break;
          }
          case 'text':
          case 'link':
          case 'markdown':
          default:
            break;
        }
      }
    }
    console.log('[Checking all entities...]');
    for await (const e of shelf.enumurateAllEntries()) {
      if ((entities.size % 100) === 0) {
        console.log('  ', `${numMoments} analyzed.`);
      }
      entities.set(e.id, e);
    }
    console.log();
    console.log('[Current Statistics]')
    console.log('  ', `Found ${numMoments} moments, ${entities.size} entities, ${usedEntities.size} entities used.`);
    console.log();
    for (const id of usedEntities) {
      entities.delete(id);
    }
    if (entities.size > 0) {
      console.log(`** Delete unused ${entities.size} entities? **`)
      for (const id of entities.keys()) {
        const e = entities.get(id)!!;
        const ans = (await terminal.question(`Unused: ${id} (type=${e.type}), https://hexe.net/entity/${id} [yN]: `)).trim().toLowerCase();
        if (ans === 'y' || ans === 'yes') {
          await shelf.deleteEntity(e);
        }
      }
    } else {
      console.log('All entities are used.');
    }
    console.log();
    console.log('All done!');
  } finally {
    terminal.close();
    await repo.close();
  }
}

main()
  .then(() => {})
  .catch((err) => {
    console.error(err);
    throw err;
  });
