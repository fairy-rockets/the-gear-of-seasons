import { describe, it } from 'mocha';
import assert from 'assert';
import * as media from './Probe.js';
import Asset from '../Asset.js';

describe("Media", () => {
  it("parse jpeg", async () => {
    const filepath = new Asset().pathOf('static/omote/kaede.jpg');
    const r = await media.probe(filepath);
    assert.equal(r.width, 1000);
    assert.equal(r.height, 1000);
  });
});
