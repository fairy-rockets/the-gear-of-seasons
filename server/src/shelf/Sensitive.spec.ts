import { describe, it } from 'mocha';
import assert from 'assert';

import * as fml from '../lib/fml.js';
import { EntityAnnotation, LooksChild, LooksNude } from './EntityAnnotation.js';
import { computeSensitive, sensitiveTargetEntityIDs } from './Sensitive.js';

const kA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const kB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function annotation(entityID: string, looksNude: LooksNude | null, looksChild: LooksChild | null): EntityAnnotation {
  return {
    entityID,
    medium: null,
    alt: null,
    description: null,
    tags: null,
    palette: null,
    characters: null,
    looksNude,
    looksChild,
    looksNote: null,
    humanVerified: false,
    role: null,
    roleGroup: null,
    roleStar: null,
    roleNote: null,
  };
}

function annotations(...list: EntityAnnotation[]): Map<string, EntityAnnotation> {
  return new Map(list.map((a) => [a.entityID, a]));
}

describe("computeSensitive", () => {
  it("nude かつ child の画像があれば true", () => {
    const doc = fml.parse(`[image entity="${kA}"]`);
    assert.strictEqual(computeSensitive(doc, annotations(annotation(kA, 'nude', 'child'))), true);
  });
  it("動画も数える", () => {
    const doc = fml.parse(`[video entity="${kA}"]`);
    assert.strictEqual(computeSensitive(doc, annotations(annotation(kA, 'nude', 'child'))), true);
  });
  it("nude と child の片方だけなら false", () => {
    const doc = fml.parse(`[image entity="${kA}"]`);
    for (const [nude, child] of [
      ['nude', 'ambiguous'], ['nude', 'adult'], ['nude', 'none'],
      ['partial', 'child'], ['unclear', 'child'], ['none', 'child'],
    ] as [LooksNude, LooksChild][]) {
      assert.strictEqual(computeSensitive(doc, annotations(annotation(kA, nude, child))), false, `${nude} × ${child}`);
    }
  });
  it("別々の画像に nude と child が分かれていても false", () => {
    const doc = fml.parse(`[image entity="${kA}"][image entity="${kB}"]`);
    assert.strictEqual(computeSensitive(doc, annotations(annotation(kA, 'nude', 'adult'), annotation(kB, 'none', 'child'))), false);
  });
  it("複数の画像のうち1つでも当てはまれば true", () => {
    const doc = fml.parse(`[image entity="${kA}"][image entity="${kB}"]`);
    assert.strictEqual(computeSensitive(doc, annotations(annotation(kA, 'none', 'none'), annotation(kB, 'nude', 'child'))), true);
  });
  it("未入力（null）や注釈の無い entity は数えない", () => {
    const doc = fml.parse(`[image entity="${kA}"][image entity="${kB}"]`);
    assert.strictEqual(computeSensitive(doc, annotations(annotation(kA, 'nude', null), annotation(kB, null, 'child'))), false);
    assert.strictEqual(computeSensitive(doc, annotations()), false);
  });
  it("音声とリンクは数えない", () => {
    const doc = fml.parse(`[audio entity="${kA}"][link entity="${kB}" text="元画像"]`);
    assert.strictEqual(computeSensitive(doc, annotations(annotation(kA, 'nude', 'child'), annotation(kB, 'nude', 'child'))), false);
  });
  it("本文に出てこない entity の注釈は数えない", () => {
    const doc = fml.parse(`[image entity="${kA}"]`);
    assert.strictEqual(computeSensitive(doc, annotations(annotation(kB, 'nude', 'child'))), false);
  });
});

describe("sensitiveTargetEntityIDs", () => {
  it("画像と動画の entity を、重ねずに返す", () => {
    const doc = fml.parse(`[image entity="${kA}"]\n\n[video entity="${kB}"]\n\n[image entity="${kA}"][audio entity="cccccccccccccccccccccccccccccccc"]`);
    assert.deepStrictEqual(sensitiveTargetEntityIDs(doc), [kA, kB]);
  });
});
