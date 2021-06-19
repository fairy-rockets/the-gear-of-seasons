import Asset from 'lib/asset';
import Server from './Server';

async function main() {
  const asset = new Asset();
  const server = await Server.create(asset);
  await server.start();
}

main()
  .then(() => {})
  .catch((err) => {
    console.error(err);
    throw err;
  });
