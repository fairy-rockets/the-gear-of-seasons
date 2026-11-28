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
  it("Image and video captions use quoted attribute values", () => {
    const doc = fml.parse('[image entity="a" link="https://example.com/" caption="  雪 [1]  "] [video caption="雪の動画" entity="b"]');
    assert.deepStrictEqual(doc.blocks, [
      { type: 'image', entity: 'a', caption: '  雪 [1]  ', link: 'https://example.com/' },
      { type: 'video', entity: 'b', caption: '雪の動画' },
    ]);
  });
  it("Parses galleries with default and explicit columns and keeps captions", () => {
    const doc = fml.parse('[gallery]\t[image entity="a" caption="絵" link="https://example.com/"]\n[/gallery][gallery caption="  雪  " columns="8"][video entity="b" caption="氷"][/gallery]');
    assert.deepStrictEqual(doc.blocks, [
      { type: 'gallery', columns: 2, caption: undefined, children: [fml.makeImage('a', '絵', 'https://example.com/')] },
      { type: 'gallery', columns: 8, caption: '  雪  ', children: [fml.makeVideo('b', '氷')] },
    ]);
    assert.deepStrictEqual([...doc.leafBlocks()], [fml.makeImage('a', '絵', 'https://example.com/'), fml.makeVideo('b', '氷')]);
    assert.deepStrictEqual(fml.parse('[image][video]').blocks, [fml.makeText('[image][video]')]);
  });

  for (const [reason, body, media] of [
    ['no closing tag', '[gallery][image entity="a"]', [fml.makeImage('a')]],
    ['empty gallery', '[gallery] [/gallery][image entity="a"]', [fml.makeImage('a')]],
    ['invalid columns', '[gallery columns="0"][image entity="a"][/gallery]', [fml.makeImage('a')]],
    ['too many columns', '[gallery columns="9"][image entity="a"][/gallery]', [fml.makeImage('a')]],
    ['fractional columns', '[gallery columns="1.5"][image entity="a"][/gallery]', [fml.makeImage('a')]],
    ['nonmedia block', '[gallery][image entity="a"][audio entity="b"][/gallery]', [fml.makeImage('a'), fml.makeAudio('b')]],
    ['nonwhitespace text', '[gallery]text[image entity="a"][/gallery]', [fml.makeImage('a')]],
    ['nested gallery', '[gallery][image entity="a"][gallery][video entity="b"][/gallery][/gallery]', [fml.makeImage('a'), fml.makeVideo('b')]],
  ] as const) {
    it(`Falls back for ${reason} and preserves media in order`, () => {
      const doc = fml.parse(body);
      assert.equal(doc.blocks[0].type, 'text');
      assert.deepStrictEqual([...doc.leafBlocks()].filter((block) => block.type !== 'text'), media);
    });
  }

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
