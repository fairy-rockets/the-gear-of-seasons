// https://jestjs.io/docs/api
import {describe, expect, it } from '@jest/globals';
import Asset from './asset';
import fs from 'fs/promises';

describe("Asset", () => {
  it("Asset dir exists", async () => {
    const asset = new Asset();
    const stat = await fs.stat(asset.pathOf(''));
    expect(stat).not.toBeNull;
  });
});
