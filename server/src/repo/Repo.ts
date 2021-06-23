import Pool from './Pool';
import { Entity } from '../shelf/Entity';

export default class Repo {
  readonly pool: Pool;
  constructor() {
    this.pool = new Pool('postgres');
  }
  findEntity(id: string): PromiseLike<Entity> {
    // language=MySQL
    const q1 = `
`;
  }
}
