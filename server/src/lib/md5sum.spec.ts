import { describe, it } from 'mocha';
import assert from 'assert';

import * as path from 'path';
import { fileURLToPath } from 'url';

import md5sum from './md5sum.js';

const dirname = path.dirname(fileURLToPath(import.meta.url))

describe("MD5SUM", () => {
  it("test empty", async () => {
    const hash = await md5sum(path.join(dirname, 'md5sum.spec.empty.blob'));
    assert.equal(hash, 'd41d8cd98f00b204e9800998ecf8427e');
  });
});
