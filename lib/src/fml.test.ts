// https://jestjs.io/docs/api
import {describe, expect, it } from '@jest/globals';
import * as fml from './fml';

describe("FML", () => {
  it("Parse empty", () => {
    const buffer = new fml.Buffer(``);
    const p = new fml.Parser(buffer);
    expect(p.parse()).toEqual(new fml.Document([]));
  });
  it("Simple text", () => {
    const buffer = new fml.Buffer(`test`);
    const p = new fml.Parser(buffer);
    expect(p.parse()).toEqual(new fml.Document([fml.makeText(`test`)]));
  });
  it("Image block", () => {
    const buffer = new fml.Buffer(`[image entity="test_id"]`);
    const p = new fml.Parser(buffer);
    expect(p.parse()).toEqual(new fml.Document([fml.makeImage("test_id")]));
  });
  it("Image mixed", () => {
    const buffer = new fml.Buffer(`aa[image entity="test_id"] aa`);
    const p = new fml.Parser(buffer);
    expect(p.parse()).toEqual(new fml.Document([
      fml.makeText("aa"),
      fml.makeImage("test_id"),
      fml.makeText("aa"),
    ]));
  });
  it("Broken brancket", () => {
    const buffer = new fml.Buffer(`aa[image entity="test`);
    const p = new fml.Parser(buffer);
    expect(p.parse()).toEqual(new fml.Document([
      fml.makeText(`aa[image entity="test`),
    ]));
  });
  it("Brancket with new line", () => {
    const buffer = new fml.Buffer(`[image\r\nentity="test_id"]`);
    const p = new fml.Parser(buffer);
    expect(p.parse()).toEqual(new fml.Document([
      fml.makeImage("test_id"),
    ]));
  });
  it("One Paragraph", () => {
    const buffer = new fml.Buffer(`\r\na\r\nb\nc\rd\r\n\r\n`);
    const p = new fml.Parser(buffer);
    expect(p.parse()).toEqual(new fml.Document([
      fml.makeText("abcd"),
    ]));
  });
  it("Paragraphs", () => {
    const buffer = new fml.Buffer(`\r\na\r\n\r\nb\n\nc\r\rd\r\n\r\n`);
    const p = new fml.Parser(buffer);
    expect(p.parse()).toEqual(new fml.Document([
      fml.makeText("a"),
      fml.makeText("b"),
      fml.makeText("cd"),
    ]));
  });
  it("Handle last", () => {
    const buffer = new fml.Buffer(`[image entity="test_id"]\n　`);
    const p = new fml.Parser(buffer);
    expect(p.parse()).toEqual(new fml.Document([fml.makeImage("test_id")]));
  });
});
