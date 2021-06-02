import fastify from 'fastify'

function main() {
  const http = fastify({
    logger: true
  });
  http.get('/', async (request, reply) => {
    reply.type('application/json').code(200)
    return { hello: 'world' }
  });
  http.listen(8888, (err, address) => {
    if(err !== null) {
      console.error(`Failed to start server @ ${address}`, err);
      throw err;
    } else {
      console.log(`Server started @ ${address}`)
    }
  });
}

main();