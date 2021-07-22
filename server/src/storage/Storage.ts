import path from 'path';
import md5sum from 'lib/md5sum';
import * as fs from 'fs/promises';

function storedPathOf(hash: string): string {
  const dir01 = hash.slice(0,2);
  const dir02 = hash.slice(2,4);
  const dir03 = hash.slice(4,6);
  const filename = hash.slice(6);
  return path.join(dir01, dir02, dir03, filename);
}

class Storage {
  private readonly base: string;
  private readonly kind: string;
  constructor(base: string, kind: string) {
    this.base = base;
    this.kind = kind;
  }
  async upload(filepath: string): Promise<string> {
    const hash = await md5sum(filepath);
    const dest = path.join(this.base, this.kind, storedPathOf(hash));
    const destDir = path.dirname(dest);
    await fs.mkdir(destDir, {
      mode: 0o755,
      recursive: true
    });
    await fs.copyFile(filepath, dest);
    return hash;
  }
  async fetch(hash: string): Promise<[string, string] | null> {
    const relativePath = path.join(this.kind, storedPathOf(hash));
    const src = path.join(this.base, relativePath);
    try {
      const st = await fs.lstat(src);
      return st.isFile() ? [this.base, relativePath] : null;
    } catch(_err) {
      return null;
    }
  }
}

export default Storage;
