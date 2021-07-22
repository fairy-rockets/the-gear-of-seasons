import { FastifyReply, FastifyRequest } from 'fastify';
import * as protocol from 'lib/protocol';
import Shelf from '../../shelf/Shelf';
import {kMomentPathFormat, kMomentTimeFormat} from '../../shelf/Moment';

export default class SaveController {
  private readonly shelf: Shelf;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
  }
  static async create(shelf: Shelf): Promise<SaveController> {
    return new SaveController(shelf);
  }
  async handle(req: FastifyRequest, reply: FastifyReply) {
    const moment = await this.shelf.saveMoment(req.body as protocol.Moment.Save.Request);
    const resp: protocol.Moment.Save.Response = {
      path: moment.timestamp.format(kMomentPathFormat),
      date: moment.timestamp.format(kMomentTimeFormat),
      body: moment.text, // TODO: render
    };
    reply
      .type('application/json')
      .code(200)
      .send(resp);
  }
}