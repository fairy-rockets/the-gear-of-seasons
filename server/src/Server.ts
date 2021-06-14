import fastify, { FastifyInstance, RouteHandlerMethod } from 'fastify'

class Server {
  private readonly http: FastifyInstance;
  private readonly both = {
    get: (path: string, handler: RouteHandlerMethod) => {
      this.http.get(path, handler);
    },
    post: (path: string, handler: RouteHandlerMethod) => {
      this.http.post(path, handler);
    }
  };
  constructor() {
    this.http = fastify({
      logger: true
    });
    this.setup();
  }

  setup() {
    this.both.get('/', async (request, reply) => {
      reply.type('application/json').code(200)
      return { hello: 'world' }
    });
  }

  async start() {
    await this.http.listen(8888, '::', 512);
  }
}

export default Server;