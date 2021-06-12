// https://jestjs.io/docs/api
import {describe, expect, it } from '@jest/globals';
import * as fml from './fml';

describe("FML", () => {
  it("Parse empty", () => {
    const buffer = new fml.Buffer("");
    const p = new fml.Parser(buffer);
    expect(p.parse()).toEqual(new fml.Document([]));
  });
  it("Simple text", () => {
    const buffer = new fml.Buffer("test");
    const p = new fml.Parser(buffer);
    expect(p.parse()).toEqual(new fml.Document([fml.text("test")]));
  });
});
