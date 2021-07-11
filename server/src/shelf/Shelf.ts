import Repo from '../repo/Repo';
import path from 'path';
import { Entity } from './Entity';
import Storage from '../storage/Storage';
import { BroadcastChannel } from 'worker_threads';

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
  async fetch(entity: Entity, type: 'original' | 'medium' | 'thumbnail') {
    switch(type) {
      case 'original':
      case 'medium':
      case 'thumbnail':
    }
  }
}

export default Shelf;
