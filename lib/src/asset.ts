import path from "path";

export default class Asset {
  constructor() {
  }
  pathOf(filepath: string): string {
    const paths = filepath.split('/');
    return path.join(__dirname, '..', '..', '_assets', ...paths);
  }
}
