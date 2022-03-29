// https://jestjs.io/docs/api
import {describe, expect, it } from '@jest/globals';
import fs from 'fs/promises';
import Asset from './asset.js';

describe("Asset", () => {
  it("Asset dir exists", async () => {
    const asset = new Asset();
    const stat = await fs.stat(asset.pathOf(''));
    expect(stat).not.toBeNull;
  });
});
