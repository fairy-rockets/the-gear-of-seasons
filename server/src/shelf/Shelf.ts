import Repo from '../repo/Repo';
import path from 'path';

class Shelf {
  private readonly path: string;
  private readonly repo: Repo;
  constructor(repo: Repo) {
    this.path = path.join(__dirname, '..', '..', '..', '_shelf');
    this.repo = repo;
  }

}

export default Shelf;