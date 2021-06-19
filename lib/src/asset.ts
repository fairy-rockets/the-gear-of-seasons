import path from 'path';
import fs from 'fs/promises';

export default class Asset {
  constructor() {
  }
  pathOf(filepath: string): string {
    const paths = filepath.split('/');
    return path.join(__dirname, '..', '..', '_assets', ...paths);
  }
  async loadString(filepath: string): Promise<string> {
    const result = await fs.readFile(
      this.pathOf(filepath),
      {
        encoding: 'utf-8'
      });
    return result;
  }
}
