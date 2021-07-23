import * as fs from 'fs/promises';
import path from 'path';

import Server from './Server';
import Shelf from './shelf/Shelf';
import Repo from './repo/Repo';

async function main() {
  const repo = new Repo();
  const shelf = new Shelf(repo);
  fs.opendir(path.join(__dirname, '..', '..', '_shelf', 'entity'))
}

main()
  .then(() => {})
  .catch((err) => {
    console.error(err);
    throw err;
  });
