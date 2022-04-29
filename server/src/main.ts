import Asset from './lib/Asset.js';

import Server from './Server.js';
import Shelf from './shelf/Shelf.js';
import Repo from './repo/Repo.js';

async function main() {
  const asset = new Asset();
  const repo = new Repo();
  const shelf = new Shelf(repo);
  const server = await Server.create(asset, shelf);
  await server.start();
}

main()
  .then(() => {})
  .catch((err) => {
    console.error(err);
    throw err;
  });
