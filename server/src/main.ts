import fastify from 'fastify'

function main() {
  const http = fastify({
    logger: true
  });
  const log = http.log;
  http.get('/', async (request, reply) => {
    reply.type('application/json').code(200)
    return { hello: 'world' }
  });
  http.listen(8888, '::', (err, address) => {
    if(err !== null) {
      log.error(err)
      throw err;
    }
  });
}

main();