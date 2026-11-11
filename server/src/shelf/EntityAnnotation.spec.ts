import { describe, it } from 'mocha';
import assert from 'assert';

import { Entity } from './Entity.js';
import { EntityAnnotation, parseAnnotationMethods, validateEntityAnnotation } from './EntityAnnotation.js';

const kID = '0123456789abcdef0123456789abcdef';

const kImage: Entity = {
  type: 'image', location: 'internal', id: kID, mediumID: 'm', iconID: 'i', timestamp: undefined, mimeType: 'image/png', width: 1, height: 1,
};
const kAudio: Entity = {
  type: 'audio', location: 'internal', id: kID, iconID: 'i', timestamp: undefined, mimeType: 'audio/mpeg', duration: 1,
};

const kExternal: Entity = {
  type: 'video', location: 'external', id: kID, iconID: 'i', timestamp: undefined, width: 1280, height: 720, duration: 60,
  externalRef: { platform: 'youtube', id: 'dQw4w9WgXcQ' },
};

const kEmpty: EntityAnnotation = {
  entityID: kID,
  methods: null,
  materials: null,
  subject: null,
  alt: null,
  description: null,
  tags: null,
  palette: null,
  characters: null,
  note: null,
  humanVerified: false,
};

describe("validateEntityAnnotation", () => {
  it("画像はすべての項目を持てる", () => {
    validateEntityAnnotation(kImage, {
      ...kEmpty,
      methods: ['draw', 'generate'], materials: ['pencil'], subject: 's', alt: 'a', description: 'd', tags: ['t'],
      palette: 'color', characters: ['c'], note: 'n', humanVerified: true,
    });
  });
  it("外部の動画も、動画の項目をすべて持てる", () => {
    validateEntityAnnotation(kExternal, {
      ...kEmpty,
      methods: ['capture'], subject: 's', alt: 'a', description: 'd', tags: ['t'], palette: 'color', characters: [],
      note: 'n', humanVerified: true,
    });
  });
  it("音声は methods・subject・alt・description・tags・note・human_verified を持てる", () => {
    validateEntityAnnotation(kAudio, {
      ...kEmpty,
      methods: ['capture', 'compose'], subject: 's', alt: 'a', description: 'd', tags: ['t'], note: 'n', humanVerified: true,
    });
  });
  it("音声が持たない項目があれば例外にする", () => {
    const cases: Partial<EntityAnnotation>[] = [
      { methods: ['draw'], materials: ['pencil'] }, { palette: 'monochrome' }, { characters: [] },
    ];
    for (const c of cases) {
      assert.throws(() => validateEntityAnnotation(kAudio, { ...kEmpty, ...c }), /cannot have/, JSON.stringify(c));
    }
  });
  it("materials は methods に draw を含むときだけ持てる", () => {
    validateEntityAnnotation(kImage, { ...kEmpty, methods: ['draw'], materials: [] });
    for (const methods of [null, ['capture'], ['render', 'generate']] as EntityAnnotation['methods'][]) {
      assert.throws(
        () => validateEntityAnnotation(kImage, { ...kEmpty, methods, materials: ['digital'] }),
        /cannot have materials unless methods includes draw/, JSON.stringify(methods));
      assert.throws(
        () => validateEntityAnnotation(kImage, { ...kEmpty, methods, materials: [] }),
        /cannot have materials unless methods includes draw/, JSON.stringify(methods));
    }
  });
  it("定義に無い値は例外にする", () => {
    assert.throws(() => validateEntityAnnotation(kImage, { ...kEmpty, palette: 'sepia' as any }), /Invalid palette/);
    assert.throws(() => validateEntityAnnotation(kImage, { ...kEmpty, methods: ['paint'] as any }), /Invalid methods/);
  });
  it("methods は空・重複・並びが kAnnotationMethods の順でないものを例外にする", () => {
    assert.throws(() => validateEntityAnnotation(kImage, { ...kEmpty, methods: [] }), /Invalid methods: empty/);
    assert.throws(() => validateEntityAnnotation(kImage, { ...kEmpty, methods: ['draw', 'draw'] }), /duplicated/);
    assert.throws(() => validateEntityAnnotation(kImage, { ...kEmpty, methods: ['capture', 'draw'] }), /order/);
  });
  it("別の entity の注釈は例外にする", () => {
    assert.throws(() => validateEntityAnnotation(kImage, { ...kEmpty, entityID: 'fedcba9876543210fedcba9876543210' }), /does not belong/);
  });
});

describe("parseAnnotationMethods", () => {
  it("kAnnotationMethods の順にそろえる", () => {
    assert.deepStrictEqual(parseAnnotationMethods(['compose', 'generate', 'draw', 'capture']), ['draw', 'capture', 'generate', 'compose']);
    assert.strictEqual(parseAnnotationMethods(null), null);
  });
  it("配列でないもの・空・重複・定義に無い値は例外にする", () => {
    for (const v of ['draw', {}, [], ['draw', 'draw'], ['drawing'], [null]]) {
      assert.throws(() => parseAnnotationMethods(v), /Invalid methods/, JSON.stringify(v));
    }
  });
});
