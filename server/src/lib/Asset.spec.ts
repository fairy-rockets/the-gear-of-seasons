import { describe, it } from 'mocha';
import assert from 'assert';
import fs from 'node:fs/promises';
import Asset from './Asset.js';

describe("Asset", () => {
  it("Asset dir exists", async () => {
    const asset = new Asset();
    const stat = await fs.stat(asset.pathOf(''));
    assert.notEqual(stat, null);
  });
});
