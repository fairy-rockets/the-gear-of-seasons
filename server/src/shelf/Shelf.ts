import Repo from '../repo/Repo';
import path from 'path';
import Storage from '../storage/Storage';
import { Entity } from './Entity';
import md5sum from 'lib/md5sum';

class Shelf {
  private readonly path: string;
  private readonly repo: Repo;
  private readonly storage: {
    original: Storage,
    medium: Storage,
    thumbnail: Storage,
  };
  constructor(repo: Repo) {
    this.path = path.join(__dirname, '..', '..', '..', '_shelf');
    this.repo = repo;
    this.storage = {
      original: new Storage('original'),
      medium: new Storage('medium'),
      thumbnail: new Storage('thumbnail'),
    };
  }
  async find(id: string): Promise<Entity | null> {
    return await this.repo.findEntity(id);
  }
  async fetch(entity: Entity, type: 'original' | 'medium' | 'thumbnail'): Promise<string | null> {
    switch(type) {
      case 'original':
        return this.storage.original.fetch(entity.id);
      case 'medium':
        return this.storage.medium.fetch(entity.mediumID);
      case 'thumbnail':
        return this.storage.thumbnail.fetch(entity.thumbnailID);
    }
  }
  async upload(filepath: string) {
    const hash = await md5sum(filepath);
    
  }
}

export default Shelf;
