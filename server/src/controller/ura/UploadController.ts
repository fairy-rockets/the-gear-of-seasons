import Shelf from '../../shelf/Shelf';
import {FastifyReply, FastifyRequest} from "fastify";

export default class UploadController {
  private readonly shelf: Shelf;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
  }
  static async create(shelf: Shelf): Promise<UploadController> {
    return new UploadController(shelf);
  }
  async handle(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as Buffer;
    const mimeType = req.headers['content-type'];
    await this.shelf.upload(body);
  }
}