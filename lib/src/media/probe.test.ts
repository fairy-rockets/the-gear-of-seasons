// https://jestjs.io/docs/api
import {describe, expect, it } from '@jest/globals';
import * as media from './probe.js';
import Asset from '../asset.js';

describe("Media", () => {
  it("parse jpeg", async () => {
    const filepath = new Asset().pathOf('static/omote/kaede.jpg');
    const r = await media.probe(filepath);
    expect(r.width).toEqual(1000);
    expect(r.height).toEqual(1000);
  });
});
