import Asset from 'lib/asset';
import Config from './Config';
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { RouteGenericInterface } from 'fastify/types/route';
import OmoteIndexController from './controller/omote/IndexController';
import UraIndexController from './controller/ura/IndexController';

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
        if (req.hostname === Config.OmoteHost) {
          await omoteHandler(req as FastifyRequest<OmoteInterface>, reply);
        } else if (req.hostname === Config.UraHost) {
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
        if (req.hostname === Config.OmoteHost) {
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
        if (req.hostname === Config.UraHost) {
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
      const omote = await OmoteIndexController.create(this.asset);
      const ura = await UraIndexController.create(this.asset);
      this.each.get(
        '/',
        async(_req, reply) => {
          omote.render(reply);
        },
        async (_req, reply) => {
          ura.render(reply);
        });
    }
  }

  async start() {
    await this.http.listen(8888, '::', 512);
  }
}

export default Server;