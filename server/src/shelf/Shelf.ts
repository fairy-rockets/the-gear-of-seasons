import Repo from '../repo/Repo';
import path from 'path';
import { Entity } from './Entity';

class Shelf {
  private readonly path: string;
  private readonly repo: Repo;
  constructor(repo: Repo) {
    this.path = path.join(__dirname, '..', '..', '..', '_shelf');
    this.repo = repo;
  }
  async find(id: string): Promise<Entity | null> {
    return await this.repo.findEntity(id);
  }
}

export default Shelf;
