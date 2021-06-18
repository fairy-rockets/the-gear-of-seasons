import Pool from './Pool';

export default class Repo {
  readonly pool: Pool;
  constructor() {
    this.pool = new Pool('postgres');
  }
}
