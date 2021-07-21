import Asset from 'lib/asset';
import Server from './Server';
import Shelf from "./shelf/Shelf";
import Repo from "./repo/Repo";

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
