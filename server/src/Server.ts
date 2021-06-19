import Asset from 'lib/asset';
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { RouteGenericInterface } from 'fastify/types/route';
import IndexController from './controller/IndexController';

const OMOTE_HOST = process.env['OMOTE_HOST'] || 'hexe.net';
const URA_HOST = process.env['URA_HOST'] || 'ura.hexe.net';

class Server {
  private readonly asset: Asset;
  private readonly http: FastifyInstance;
  private readonly both = {
    get: <Interface extends RouteGenericInterface = RouteGenericInterface>(path: string, handler: (req: FastifyRequest<Interface>, reply: FastifyReply) => PromiseLike<void>) => {
      this.http.get<Interface>(path, async (req, reply) => {
        await handler(req, reply);
      });
    }
  };
  private readonly each = {
    get: <
        OmoteInterface extends RouteGenericInterface = RouteGenericInterface,
        UraInterface extends RouteGenericInterface = RouteGenericInterface,
      >(path: string,
        omoteHandler: (req: FastifyRequest<OmoteInterface>, reply: FastifyReply) => PromiseLike<void>,
        uraHandler: (req: FastifyRequest<UraInterface>, reply: FastifyReply) => PromiseLike<void>,
      ) => {
      this.http.get(path, async (req, reply) => {
        if (req.hostname === OMOTE_HOST) {
          await omoteHandler(req as FastifyRequest<OmoteInterface>, reply);
        } else if (req.hostname === URA_HOST) {
          await uraHandler(req as FastifyRequest<UraInterface>, reply);
        } else {
          reply.type('text/plain').code(404);
          reply.send('Page not found');
        }
      });
    }
  };
  private readonly omote = {
    get: <Interface extends RouteGenericInterface = RouteGenericInterface>(path: string, handler: (req: FastifyRequest<Interface>, reply: FastifyReply) => PromiseLike<void>) => {
      this.http.get<Interface>(path, async (req, reply) => {
        if (req.hostname === OMOTE_HOST) {
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
        if (req.hostname === URA_HOST) {
          await handler(req, reply);
        } else {
          reply.type('text/plain').code(404);
          reply.send('Page not found');
        }
      });
    }
  };
  private constructor(asset: Asset) {
    this.asset = asset;
    this.http = fastify({
      logger: true,
      bodyLimit: 256*1024*1024,
      maxParamLength: 1024*1024,
    });
  }

  static async create(asset: Asset): Promise<Server> {
    const server = new Server(asset);
    await server.setup();
    return server;
  }

  async setup() {
    { // index
      const index = await IndexController.create(this.asset);
      this.each.get(
        '/',
        async(req, reply) => {
          index.render(reply);
        },
        async (req, reply) => {
          reply.type('application/json').code(200);
          reply.send({ hello: 'world' });
        });
    }
  }

  async start() {
    await this.http.listen(8888, '::', 512);
  }
}

export default Server;