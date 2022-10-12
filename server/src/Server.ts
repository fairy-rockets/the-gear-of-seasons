import path from 'path';
import { fileURLToPath } from 'url';

import dayjs from 'dayjs';
import fastify, { FastifyBaseLogger,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  FastifySchema,
  FastifyTypeProviderDefault,
  RawServerDefault
} from 'fastify';
import {RouteGenericInterface} from 'fastify/types/route';
import fastifyStatic from '@fastify/static';

import Asset from './lib/Asset.js';

import Config from './Config.js';
import Shelf from './shelf/Shelf.js';

// Omote Controllers
import OmoteIndexController from './controller/omote/IndexController.js';
import MomentController from './controller/omote/MomentController.js';
import RandomSelectionController, {
  RandomSelectionControllerInterface
} from './controller/omote/RandomSelectionController.js';
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

type Handler =
  (req: FastifyRequest, reply: FastifyReply) => PromiseLike<FastifyReply>;

type HandlerSet = {
  omote?: Handler,
  ura?: Handler,
};


const dirname = path.dirname(fileURLToPath(import.meta.url));

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
      bodyLimit: 256 * 1024 * 1024,
      maxParamLength: 1024 * 1024,
    });
    this.onClose = new Promise<void>((resolve, reject) => {
      this.http.addHook('onClose', async (_instance) => {
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
    }, async (_req: any, body: Buffer) => body);
    // -----------
    // Routing
    // -----------
    { // (omote,ura)/
      const omote = await OmoteIndexController.create(this.asset);
      const ura = await UraIndexController.create(this.asset);
      this.each.get('/', {
        omote: omote.handle.bind(omote),
        ura: ura.handle.bind(ura),
      });
      // (omote)/about-us/
      this.omote.get('/about-us/', omote.handle.bind(omote));
    }
    { // (ura/omote)/year/month/day/HH:mm:ss/
      const omote = await MomentController.create(this.asset, this.shelf);
      const ura = await EditController.create(this.asset, this.shelf);
      this.each.get('/:year(^[0-9]{4}$)/:month(^[0-9]{2}$)/:day(^[0-9]{2}$)/:time(^[0-9]{2}:[0-9]{2}:[0-9]{2}$)/', {
        omote: omote.handle.bind(omote),
        ura: ura.handle.bind(ura),
      });
    }
    { // (omote)/moments/random
      const omote = await RandomSelectionController.create(this.shelf);
      this.omote.get('/moments/random', omote.handle.bind(omote));
    }
    { // (both)/moment/year/month/day/HH:mm:ss/
      const c = await MomentBodyController.create(this.shelf);
      this.both.get('/moment/:year(^[0-9]{4}$)/:month(^[0-9]{2}$)/:day(^[0-9]{2}$)/:time(^[0-9]{2}:[0-9]{2}:[0-9]{2}$)/', c.handle.bind(c));
    }
    { // (ura)/entity
      const c = await EntityController.create(this.shelf);
      this.both.get('/entity/:id', async (req, reply) => c.handle('original', req, reply));
      this.both.get('/entity/:id/medium', async (req, reply) => c.handle('medium', req, reply));
      this.both.get('/entity/:id/icon', async (req, reply) => c.handle('icon', req, reply));
    }
    { // (ura)/moments
      const ura = await MomentListController.create(this.asset, this.shelf);
      this.ura.get(
        '/moments/',
        async (req, reply) => reply.redirect(303, `/moments/${dayjs().year()}`));
      this.ura.get('/moments/:year', ura.handle.bind(ura));
    }
    { // (ura)/new
      const ura = await NewController.create(this.asset);
      this.ura.get('/new', ura.handle.bind(ura));
    }
    { // (ura)/save
      const ura = await SaveController.create(this.shelf);
      this.ura.post('/save', ura.handle.bind(ura));
    }
    { // (ura)/delete
      const ura = await DeleteController.create(this.shelf);
      this.ura.post('/delete', ura.handle.bind(ura));
    }
    { // (ura)/preview
      const ura = await PreviewController.create(this.shelf);
      this.ura.post('/preview', ura.handle.bind(ura));
    }
    { // (ura)/upload
      const ura = await UploadController.create(this.shelf);
      this.ura.post('/upload', ura.handle.bind(this));
    }

    { // (omote/ura)/static/*
      this.each.get('/static/*', {
        omote: async(req, reply) => {
          const url = req.url;
          return reply
            .code(200)
            .sendFile(path.join('omote', url.slice(8)), staticRoot);
        },
        ura: async (req, reply) => {
          const url = req.url;
          return reply
            .code(200)
            .sendFile(path.join('ura', url.slice(8)), staticRoot);
        }
      });
    }
    { // (omote/ura)/js/*
      this.each.get('/js/*', {
        omote: async(req, reply) => {
          const url = req.url;
          return reply
            .code(200)
            .sendFile(path.join('omote', url.slice(4)), jsRoot);
        },
        ura: async (req, reply) => {
          const url = req.url;
          return reply
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
    get: (path: string, handler: Handler) => {
      this.http.get(path, handler);
    }
  };
  private readonly each = {
    get: (path: string, handlerSet: HandlerSet) => {
      this.http.get(path, async (req, reply) => {
        if (req.hostname === Config.OmoteHost && handlerSet.omote !== undefined) {
          return handlerSet.omote(req as FastifyRequest, reply);
        } else if (req.hostname === Config.UraHost && handlerSet.ura !== undefined) {
          return handlerSet.ura(req as FastifyRequest, reply);
        } else {
          return reply
            .code(404)
            .type('text/plain;charset=UTF-8')
            .send('Page not found');
        }
      });
    }
  };
  private readonly omote = {
    get: (path: string, handler: Handler) => {
      this.http.get(path, async (req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
        if (req.hostname === Config.OmoteHost) {
          return handler(req, reply);
        } else {
          return reply
            .type('text/plain')
            .code(404)
            .send('Page not found');
        }
      });
    }
  };
  private readonly ura = {
    get: (path: string, handler: Handler) => {
      this.http.get(path, async (req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
        if (req.hostname === Config.UraHost) {
          return handler(req, reply);
        } else {
          return reply
            .type('text/plain')
            .code(404)
            .send('Page not found');
        }
      });
    },
    post: (path: string, handler: Handler) => {
      this.http.post(path, async (req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
        if (req.hostname === Config.UraHost) {
          return handler(req, reply);
        } else {
          return reply
            .type('text/plain')
            .code(404)
            .send('Page not found');
        }
      });
    }
  };

}

export default Server;
