import Asset from 'lib/asset';
import Config from './Config';
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyStatic from 'fastify-static';
import path from 'path';
import { RouteGenericInterface } from 'fastify/types/route';
import Shelf from './shelf/Shelf';

// Omote Controllers
import OmoteIndexController from './controller/omote/IndexController';
// Ura Controllers
import UraIndexController from './controller/ura/IndexController';
import UploadController from './controller/ura/UploadController';
import NewController from './controller/ura/NewController';
import SaveController from './controller/ura/SaveController';
// Both Controllers
import EntityController, {EntityControllerInterface} from './controller/both/EntityController';

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
    const jsRoot = path.join(__dirname, '..', '..', 'client', 'dist');
    const staticRoot = this.asset.pathOf('static');
    this.http.register(fastifyStatic, {
      root: [
        staticRoot,
        jsRoot,
        this.shelf.storagePath,
      ],
      serve: false,
    });
    this.http.addContentTypeParser<Buffer>(/^(image|video|audio)\/.*$/, {
      parseAs: 'buffer',
    },async (_req: any, body: Buffer) => body);
    { // (omote,ura)/
      const omote = await OmoteIndexController.create(this.asset);
      const ura = await UraIndexController.create(this.asset);
      this.each.get('/', {
        omote: async(req, reply) => {
          await omote.handle(req, reply);
        },
        ura: async (req, reply) => {
          await ura.handle(req, reply);
        }
      });
    }
    { // (ura)/entity
      const c = await EntityController.create(this.shelf);
      this.both.get<EntityControllerInterface>('/entity/:id', async (req, reply) => {
        await c.handle('original', req, reply);
      });
      this.both.get<EntityControllerInterface>('/entity/:id/medium', async (req, reply) => {
        await c.handle('medium', req, reply);
      });
      this.both.get<EntityControllerInterface>('/entity/:id/icon', async (req, reply) => {
        await c.handle('icon', req, reply);
      });
    }
    { // (ura)/new
      const ura = await NewController.create(this.asset);
      this.ura.get('/new', async (req, reply) => {
        await ura.handle(req, reply);
      });
    }
    { // (ura)/new
      const ura = await SaveController.create(this.shelf);
      this.ura.post('/save', async (req, reply) => {
        await ura.handle(req, reply);
      });
    }
    { // file uploads
      const ura = await UploadController.create(this.shelf);
      this.ura.post('/upload', async(req, reply) => {
        await ura.handle(req, reply);
      });
    }

    { // (omote/ura)/static/*
      this.each.get('/static/*', {
        omote: async(req, reply) => {
          const url = req.url;
          reply
            .code(200)
            .sendFile(path.join('omote', url.slice(8)), staticRoot);
        },
        ura: async (req, reply) => {
          const url = req.url;
          reply
            .code(200)
            .sendFile(path.join('ura', url.slice(8)), staticRoot);
        }
      });
    }
    { // (omote/ura)/js/*
      this.each.get('/js/*', {
        omote: async(req, reply) => {
          const url = req.url;
          reply
            .code(200)
            .sendFile(path.join('omote', url.slice(4)), jsRoot);
        },
        ura: async (req, reply) => {
          const url = req.url;
          reply
            .code(200)
            .sendFile(path.join('ura', url.slice(4)), jsRoot);
        }
      });
    }
  }

  /* **************************************************************************
   * start/exit
   * **************************************************************************/

  async start() {
    await this.http.ready();
    await this.http.listen(8888, '::', 512);
  }

  /* **************************************************************************
   * routing helpers
   * **************************************************************************/
  private readonly both = {
    get: <Interface extends RouteGenericInterface>(path: string, handler: (req: FastifyRequest<Interface>, reply: FastifyReply) => PromiseLike<void>) => {
      this.http.get<Interface>(path, async (req, reply) => {
        await handler(req, reply);
        return reply;
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
          return reply;
        } else if (req.hostname === Config.UraHost && handlerSet.ura !== undefined) {
          await handlerSet.ura(req as FastifyRequest<UraInterface>, reply);
          return reply;
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
          return reply;
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
          return reply;
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
          return reply;
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