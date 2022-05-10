import path from 'path';
import { fileURLToPath } from 'url';

import dayjs from 'dayjs';
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { RouteGenericInterface } from 'fastify/types/route';
import fastifyStatic from '@fastify/static';

import Asset from './lib/Asset.js';

import Config from './Config.js';
import Shelf from './shelf/Shelf.js';

// Omote Controllers
import OmoteIndexController from './controller/omote/IndexController.js';
import MomentController from './controller/omote/MomentController.js';
import RandomSelectionController, {RandomSelectionControllerInterface} from './controller/omote/RandomSelectionController.js';
// Ura Controllers
import UraIndexController from './controller/ura/IndexController.js';
import MomentListController, {MomentListControllerInterface} from './controller/ura/MomentListController.js';
import UploadController from './controller/ura/UploadController.js';
import NewController from './controller/ura/NewController.js';
import EditController from './controller/ura/EditController.js';
import SaveController from './controller/ura/SaveController.js';
import DeleteController from './controller/ura/DeleteController.js';
import PreviewController from './controller/ura/PreviewController.js';
// Both Controllers
import EntityController, {EntityControllerInterface} from './controller/both/EntityController.js';
import MomentBodyController from './controller/both/MomentBodyController.js';

type Handler<Interface extends RouteGenericInterface> = 
  (req: FastifyRequest<Interface>, reply: FastifyReply) => PromiseLike<void>;

type HandlerSet<
  OmoteInterface extends RouteGenericInterface,
  UraInterface extends RouteGenericInterface,
> = {
  omote?: Handler<OmoteInterface>,
  ura?: Handler<UraInterface>,
};

const dirname = path.dirname(fileURLToPath(import.meta.url))

class Server {
  private readonly asset: Asset;
  private readonly shelf: Shelf;
  private readonly http: FastifyInstance;
  private readonly onClose: Promise<void>;

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
    this.onClose = new Promise<void>((resolve, reject) => {
      this.http.addHook('onClose', async(_instance) => {
        resolve();
      });
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
    // -----------
    // Plugins
    // -----------
    const jsRoot = path.join(dirname, '..', '..', 'client', 'dist');
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
    // -----------
    // Routing
    // -----------
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
      // (omote)/about-us/
      this.omote.get('/about-us/', async(req, reply) => {
        await omote.handle(req, reply);
      });
    }
    { // (ura/omote)/year/month/day/HH:mm:ss/
      const omote = await MomentController.create(this.asset, this.shelf);
      const ura = await EditController.create(this.asset, this.shelf);
      this.each.get('/:year(^[0-9]{4}$)/:month(^[0-9]{2}$)/:day(^[0-9]{2}$)/:time(^[0-9]{2}:[0-9]{2}:[0-9]{2}$)/', {
        omote: async (req, reply) => {
          await omote.handle(req, reply);
        },
        ura: async (req, reply) => {
          await ura.handle(req, reply);
        },
      });
    }
    { // (omote)/moments/random
      const omote = await RandomSelectionController.create(this.shelf);
      this.omote.get<RandomSelectionControllerInterface>('/moments/random', async (req, reply) => {
        await omote.handle(req, reply);
      });
    }
    { // (both)/moment/year/month/day/HH:mm:ss/
      const c = await MomentBodyController.create(this.shelf);
      this.both.get('/moment/:year(^[0-9]{4}$)/:month(^[0-9]{2}$)/:day(^[0-9]{2}$)/:time(^[0-9]{2}:[0-9]{2}:[0-9]{2}$)/', async (req, reply) => {
        await c.handle(req, reply);
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
    { // (ura)/moments
      const ura = await MomentListController.create(this.asset, this.shelf);
      this.ura.get<MomentListControllerInterface>('/moments/', async (req, reply) => {
        reply.redirect(303, `/moments/${dayjs().year()}`);
      });
      this.ura.get<MomentListControllerInterface>('/moments/:year', async (req, reply) => {
        await ura.handle(req, reply);
      });
    }
    { // (ura)/new
      const ura = await NewController.create(this.asset);
      this.ura.get('/new', async (req, reply) => {
        await ura.handle(req, reply);
      });
    }
    { // (ura)/save
      const ura = await SaveController.create(this.shelf);
      this.ura.post('/save', async (req, reply) => {
        await ura.handle(req, reply);
      });
    }
    { // (ura)/delete
      const ura = await DeleteController.create(this.shelf);
      this.ura.post('/delete', async (req, reply) => {
        await ura.handle(req, reply);
      });
    }
    { // (ura)/preview
      const ura = await PreviewController.create(this.shelf);
      this.ura.post('/preview', async (req, reply) => {
        await ura.handle(req, reply);
      });
    }
    { // (ura)/upload
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

  async listen() {

    await this.http.ready();
    console.log(this.http.printRoutes());
    await this.http.listen(8888, '::', 512);
    await this.onClose;
  }
  async exit() {
    await this.http.close();
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
