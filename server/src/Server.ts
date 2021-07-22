import Asset from 'lib/asset';
import Config from './Config';
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyStatic from 'fastify-static';
import path from 'path';
import { RouteGenericInterface } from 'fastify/types/route';
import OmoteIndexController from './controller/omote/IndexController';
import UraIndexController from './controller/ura/IndexController';
import NewController from './controller/ura/NewController';
import UploadController from './controller/ura/UploadController';
import Shelf from './shelf/Shelf';

type Handler<Interface extends RouteGenericInterface> = 
  (req: FastifyRequest<Interface>, reply: FastifyReply) => PromiseLike<void>;

type HandlerSet<
  OmoteInterface extends RouteGenericInterface,
  UraInterface extends RouteGenericInterface,
> = {
  omote?: Handler<OmoteInterface>,
  ura?: Handler<UraInterface>,
};

class Server {
  private readonly asset: Asset;
  private readonly shelf: Shelf;
  private readonly http: FastifyInstance;

  /* **************************************************************************
   * constructors
   * **************************************************************************/

  private constructor(asset: Asset, shelf: Shelf) {
    this.asset = asset;
    this.shelf = shelf;
    this.http = fastify({
      logger: true,
      bodyLimit: 256*1024*1024,
      maxParamLength: 1024*1024,
    });
    this.http.addContentTypeParser<Buffer>(/^(image|video|audio)\/.*$/, {
      parseAs: 'buffer',
    },async (_req: any, body: Buffer) => {
      return body;
    });
  }

  static async create(asset: Asset, shelf: Shelf): Promise<Server> {
    const server = new Server(asset, shelf);
    await server.setup();
    return server;
  }

  /* **************************************************************************
   * routes
   * **************************************************************************/

  async setup() {
    const log = this.http.log;
    const jsRoot = path.join(__dirname, '..', '..', 'client', 'dist');
    const staticRoot = this.asset.pathOf('static');
    this.http.register(fastifyStatic, {
      root: [
        staticRoot,
        jsRoot,
      ],
    });
    { // (omote,ura)/
      const omote = await OmoteIndexController.create(this.asset);
      const ura = await UraIndexController.create(this.asset);
      this.each.get('/', {
        omote: async(_req, reply) => {
          omote.render(reply);
        },
        ura: async (_req, reply) => {
          ura.render(reply);
        }
      });
    }
    { // (ura)/new
      const ura = await NewController.create(this.asset);
      this.ura.get('/new', async (req, reply) => {
        ura.render(reply);
      });
    }
    { // file uploads
      const ura = await UploadController.create(this.shelf);
      this.ura.post('/upload', async(req, reply) => {
        const body = req.body as Buffer;
        log.info(body.byteLength);
        log.info(req.headers["content-type"]);
      });
    }
    { // (omote/ura)/static/*
      this.each.get('/static/*', {
        omote: async(req, reply) => {
          const url = req.url;
          reply.sendFile(path.join('omote', url.slice(8)), staticRoot);
        },
        ura: async (req, reply) => {
          const url = req.url;
          reply.sendFile(path.join('ura', url.slice(8)), staticRoot);
        }
      });
    }
    { // (omote/ura)/js/*
      this.each.get('/js/*', {
        omote: async(req, reply) => {
          const url = req.url;
          reply.sendFile(path.join('omote', url.slice(4)), jsRoot);
        },
        ura: async (req, reply) => {
          const url = req.url;
          reply.sendFile(path.join('ura', url.slice(4)), jsRoot);
        }
      });
    }
  }

  /* **************************************************************************
   * start/exit
   * **************************************************************************/

  async start() {
    await this.http.listen(8888, '::', 512);
  }

  /* **************************************************************************
   * routing helpers
   * **************************************************************************/
  private readonly both = {
    get: <Interface extends RouteGenericInterface>(path: string, handler: (req: FastifyRequest<Interface>, reply: FastifyReply) => PromiseLike<void>) => {
      this.http.get<Interface>(path, async (req, reply) => {
        await handler(req, reply);
      });
    }
  };
  private readonly each = {
    get: <
      OmoteInterface extends RouteGenericInterface,
      UraInterface extends RouteGenericInterface,
      >(path: string,
        handlerSet: HandlerSet<OmoteInterface, UraInterface>
    ) => {
      this.http.get(path, async (req, reply) => {
        if (req.hostname === Config.OmoteHost && handlerSet.omote !== undefined) {
          await handlerSet.omote(req as FastifyRequest<OmoteInterface>, reply);
        } else if (req.hostname === Config.UraHost && handlerSet.ura !== undefined) {
          await handlerSet.ura(req as FastifyRequest<UraInterface>, reply);
        } else {
          reply
            .type('text/plain')
            .code(404)
            .send('Page not found');
        }
      });
    }
  };
  private readonly omote = {
    get: <Interface extends RouteGenericInterface>(path: string, handler: (req: FastifyRequest<Interface>, reply: FastifyReply) => PromiseLike<void>) => {
      this.http.get<Interface>(path, async (req, reply) => {
        if (req.hostname === Config.OmoteHost) {
          await handler(req, reply);
        } else {
          reply
            .type('text/plain')
            .code(404)
            .send('Page not found');
        }
      });
    }
  };
  private readonly ura = {
    get: <Interface extends RouteGenericInterface>(path: string, handler: (req: FastifyRequest<Interface>, reply: FastifyReply) => PromiseLike<void>) => {
      this.http.get<Interface>(path, async (req, reply) => {
        if (req.hostname === Config.UraHost) {
          await handler(req, reply);
        } else {
          reply
            .type('text/plain')
            .code(404)
            .send('Page not found');
        }
      });
    },
    post: <Interface extends RouteGenericInterface>(path: string, handler: (req: FastifyRequest<Interface>, reply: FastifyReply) => PromiseLike<void>) => {
      this.http.post<Interface>(path, async(req, reply) => {
        if (req.hostname === Config.UraHost) {
          await handler(req, reply);
        } else {
          reply
            .type('text/plain')
            .code(404)
            .send('Page not found');
        }
      });
    }
  };

}

export default Server;