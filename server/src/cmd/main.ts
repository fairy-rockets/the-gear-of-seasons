import v8 from 'node:v8';
import fs from 'node:fs';

import Asset from '../lib/Asset.js';

import Server from '../Server.js';
import Shelf from '../shelf/Shelf.js';
import Repo from '../repo/Repo.js';

async function main() {
  process.on('SIGUSR1', () => {
    const fileName = `/share/heapdump_${Date.now()}.heapsnapshot`;
    const snapshotStream = v8.getHeapSnapshot();
    const fileStream = fs.createWriteStream(fileName);
    snapshotStream.pipe(fileStream);
    snapshotStream.on('end', () => {
      fileStream.close();
    });
  });
  const asset = new Asset();
  const repo = new Repo();
  const shelf = new Shelf(repo);
  try {
    const server = await Server.create(asset, shelf);
    process.on('exit', () => {
      server.exit()
        .then(() => {
          console.log('Server exited.');
        })
        .catch((err) => {
          console.log(`Failed to exit server: ${err}`);
        });
    });
    await server.listen();
  } finally {
    console.log('Closing repo...');
    await repo.close();
  }
}

main()
  .then(() => {})
  .catch((err) => {
    throw err;
  });
