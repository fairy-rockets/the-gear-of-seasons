import {FastifyReply, FastifyRequest} from 'fastify';

import Shelf from '../../shelf/Shelf.js';
import { ExternalVideoError } from '../../shelf/ExternalVideo.js';

function errorReply(reply: FastifyReply, statusCode: number, error: string, message: string): FastifyReply {
  return reply
    .type('application/json;charset=UTF-8')
    .code(statusCode)
    .send({ statusCode, error, message });
}

// ura の編集画面の ↑ の URL 欄が使う口。外部（今は YouTube だけ）の動画の URL を受け取って entity にし、
// /upload と同じく、本文に挿入する fml を返す。
export default class InsertEmbedController {
  private readonly shelf: Shelf;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
  }
  static async create(shelf: Shelf): Promise<InsertEmbedController> {
    return new InsertEmbedController(shelf);
  }
  async handle(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const body = req.body as { url?: unknown } | null | undefined;
    const url = typeof body === 'object' && body !== null ? body.url : undefined;
    if (typeof url !== 'string' || url.trim().length === 0) {
      return errorReply(reply, 400, 'Bad Request', 'url がありません');
    }
    let entity;
    try {
      entity = await this.shelf.insertExternalVideo(url.trim());
    } catch (e) {
      if (e instanceof ExternalVideoError) {
        const error = e.statusCode === 400 ? 'Bad Request' : e.statusCode === 503 ? 'Service Unavailable' : 'Bad Gateway';
        return errorReply(reply, e.statusCode, error, e.message);
      }
      throw e;
    }
    return reply
      .type('text/plain;charset=UTF-8')
      .code(200)
      .send(`[${entity.type} entity="${entity.id}"]`);
  }
}
