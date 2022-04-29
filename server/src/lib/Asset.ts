import path from 'path';
import fs from 'fs/promises';
import {fileURLToPath} from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default class Asset {
  constructor() {
  }
  pathOf(filepath: string): string {
    const paths = filepath.split('/');
    return path.join(dirname, '..', '..', '_assets', ...paths);
  }
  async loadString(filepath: string): Promise<string> {
    return await fs.readFile(
      this.pathOf(filepath),
      {
        encoding: 'utf-8'
      });
  }
}
