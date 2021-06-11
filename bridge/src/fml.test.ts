// https://jestjs.io/docs/api
import {describe, expect, it } from '@jest/globals';
import { FML } from './fml';

describe("FML", () => {
  it("Parse empty", () => {
    const p = new FML.Parser("");
  });
});
