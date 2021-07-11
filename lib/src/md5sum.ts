import crypto from 'crypto';
import * as fs from 'fs/promises';

async function md5sum(path: string): Promise<string> {
  const content = await fs.readFile(path);
  return crypto.createHash('md5').update(content).digest('hex');
}

export default md5sum;