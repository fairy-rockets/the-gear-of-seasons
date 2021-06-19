import Server from './Server';

async function main() {
  const server = new Server();
  await server.start();
}

main()
  .then(() => {})
  .catch((err) => {
    console.error(err);
    throw err;
  });
