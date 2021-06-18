import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { RouteGenericInterface } from 'fastify/types/route';

const OMOTE_HOST = process.env['OMOTE_HOST'] || 'hexe.net';
const URA_HOST = process.env['URA_HOST'] || 'ura.hexe.net';

class Server {
  private readonly http: FastifyInstance;
  private readonly both = {
    get: <Interface extends RouteGenericInterface = RouteGenericInterface>(path: string, handler: (req: FastifyRequest<Interface>, reply: FastifyReply) => PromiseLike<void>) => {
      this.http.get<Interface>(path, async (req, reply) => {
        await handler(req, reply);
      });
    }
  };
  private readonly omote = {
    get: <Interface extends RouteGenericInterface = RouteGenericInterface>(path: string, handler: (req: FastifyRequest<Interface>, reply: FastifyReply) => PromiseLike<void>) => {
      this.http.get<Interface>(path, async (req, reply) => {
        if(req.hostname === OMOTE_HOST) {
          await handler(req, reply);
        } else {
          reply.type('text/plain').code(404);
          reply.send('Page not found');
        }
      });
    }
  };
  private readonly ura = {
    get: <Interface extends RouteGenericInterface = RouteGenericInterface>(path: string, handler: (req: FastifyRequest<Interface>, reply: FastifyReply) => PromiseLike<void>) => {
      this.http.get<Interface>(path, async (req, reply) => {
        if(req.hostname === URA_HOST) {
          await handler(req, reply);
        } else {
          reply.type('text/plain').code(404);
          reply.send('Page not found');
        }
      });
    }
  };
  constructor() {
    this.http = fastify({
      logger: true,
      bodyLimit: 256*1024*1024,
      maxParamLength: 1024*1024,
    });
    this.setup();
  }

  setup() {
    this.both.get('/', async (req, reply) => {
      reply.type('application/json').code(200);
      reply.send({ hello: 'world' });
    });
  }

  async start() {
    await this.http.listen(8888, '::', 512);
  }
}

export default Server;