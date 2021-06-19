// https://jestjs.io/docs/api
import {describe, expect, it } from '@jest/globals';
import * as media from './media';
import * as path from 'path';
import Asset from './asset';

describe("Media", () => {
  it("parse jpeg", async () => {
    const filepath = new Asset().pathOf('static/kaede.jpg');
    const r = await media.probe(filepath);
    expect(r.width).toEqual(1000);
    expect(r.height).toEqual(1000);
  });
});
