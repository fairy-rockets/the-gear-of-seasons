import { describe, it } from 'mocha';
import assert from 'assert';
import * as fml from './fml.js';

describe("FML", () => {
  it("Parse empty", () => {
    const buffer = new fml.Buffer(``);
    const p = new fml.Parser(buffer);
    assert.deepEqual(p.parse(), new fml.Document([]));
  });
  it("Simple text", () => {
    const buffer = new fml.Buffer(`test`);
    const p = new fml.Parser(buffer);
    assert.deepEqual(p.parse(), new fml.Document([fml.makeText(`test`)]));
  });
  it("Image block", () => {
    const buffer = new fml.Buffer(`[image entity="test_id"]`);
    const p = new fml.Parser(buffer);
    assert.deepEqual(p.parse(), new fml.Document([fml.makeImage("test_id")]));
  });
  it("Image mixed", () => {
    const buffer = new fml.Buffer(`aa[image entity="test_id"] aa`);
    const p = new fml.Parser(buffer);
    assert.deepEqual(p.parse(), new fml.Document([
      fml.makeText("aa"),
      fml.makeImage("test_id"),
      fml.makeText("aa"),
    ]));
  });
  // 空白で区切って並べたブロックが、2 つめからテキストに化けていた。
  it("Blocks separated by a space", () => {
    const buffer = new fml.Buffer(`[image entity="a"] [image entity="b"]`);
    const p = new fml.Parser(buffer);
    assert.deepEqual(p.parse(), new fml.Document([
      fml.makeImage("a"),
      fml.makeImage("b"),
    ]));
  });
  it("Three blocks separated by spaces", () => {
    const buffer = new fml.Buffer(`[image entity="a"] [image entity="b"] [image entity="c"]`);
    const p = new fml.Parser(buffer);
    assert.deepEqual(p.parse(), new fml.Document([
      fml.makeImage("a"),
      fml.makeImage("b"),
      fml.makeImage("c"),
    ]));
  });
  it("Block after text and a space", () => {
    const buffer = new fml.Buffer(`aa [image entity="a"]`);
    const p = new fml.Parser(buffer);
    assert.deepEqual(p.parse(), new fml.Document([
      fml.makeText("aa "),
      fml.makeImage("a"),
    ]));
  });
  it("Broken brancket after a space", () => {
    const buffer = new fml.Buffer(`[image entity="a"] [image entity="b`);
    const p = new fml.Parser(buffer);
    assert.deepEqual(p.parse(), new fml.Document([
      fml.makeImage("a"),
      fml.makeText(`[image entity="b`),
    ]));
  });
  it("Broken brancket", () => {
    const buffer = new fml.Buffer(`aa[image entity="test`);
    const p = new fml.Parser(buffer);
    assert.deepEqual(p.parse(), (new fml.Document([
      fml.makeText(`aa[image entity="test`),
    ])));
  });
  it("Brancket with new line", () => {
    const buffer = new fml.Buffer(`[image\r\nentity="test_id"]`);
    const p = new fml.Parser(buffer);
    assert.deepEqual(p.parse(), new fml.Document([
      fml.makeImage("test_id"),
    ]));
  });
  it("One Paragraph", () => {
    const buffer = new fml.Buffer(`\r\na\r\nb\nc\rd\r\n\r\n`);
    const p = new fml.Parser(buffer);
    assert.deepEqual(p.parse(), new fml.Document([
      fml.makeText("abcd"),
    ]));
  });
  it("Paragraphs", () => {
    const buffer = new fml.Buffer(`\r\na\r\n\r\nb\n\nc\r\rd\r\n\r\n`);
    const p = new fml.Parser(buffer);
    assert.deepEqual(p.parse(), new fml.Document([
      fml.makeText("a"),
      fml.makeText("b"),
      fml.makeText("cd"),
    ]));
  });
  it("Handle last", () => {
    const buffer = new fml.Buffer(`[image entity="test_id"]\n　`);
    const p = new fml.Parser(buffer);
    assert.deepEqual(p.parse(), new fml.Document([fml.makeImage("test_id")]));
  });
});
