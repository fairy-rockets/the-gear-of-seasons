import { describe, it } from 'mocha';
import assert from 'assert';

import { Entity } from './Entity.js';
import { EntityAnnotation, validateEntityAnnotation } from './EntityAnnotation.js';

const kID = '0123456789abcdef0123456789abcdef';

const kImage: Entity = {
  type: 'image', id: kID, mediumID: 'm', iconID: 'i', timestamp: undefined, mimeType: 'image/png', width: 1, height: 1,
};
const kAudio: Entity = {
  type: 'audio', id: kID, iconID: 'i', timestamp: undefined, mimeType: 'audio/mpeg', duration: 1,
};

const kEmpty: EntityAnnotation = {
  entityID: kID,
  medium: null,
  alt: null,
  description: null,
  tags: null,
  palette: null,
  characters: null,
  looksNude: null,
  looksChild: null,
  looksNote: null,
  checked: false,
  role: null,
  roleGroup: null,
  roleStar: null,
  roleNote: null,
};

describe("validateEntityAnnotation", () => {
  it("画像はすべての項目を持てる", () => {
    validateEntityAnnotation(kImage, {
      ...kEmpty,
      medium: 'drawing', alt: 'a', description: 'd', tags: ['t'], palette: 'color', characters: ['c'],
      looksNude: 'none', looksChild: 'child', looksNote: 'n', checked: true,
      role: 'grab', roleGroup: 'g', roleStar: false, roleNote: 'r',
    });
  });
  it("音声は alt・description・tags だけを持てる", () => {
    validateEntityAnnotation(kAudio, { ...kEmpty, alt: 'a', description: 'd', tags: ['t'] });
  });
  it("音声が持たない項目があれば例外にする", () => {
    const cases: Partial<EntityAnnotation>[] = [
      { medium: 'photo' }, { palette: 'monochrome' }, { characters: [] },
      { looksNude: 'none' }, { looksChild: 'none' }, { looksNote: '' },
      { role: 'none' }, { roleGroup: '' }, { roleStar: false }, { roleNote: '' },
      { checked: true },
    ];
    for (const c of cases) {
      assert.throws(() => validateEntityAnnotation(kAudio, { ...kEmpty, ...c }), /cannot have/, JSON.stringify(c));
    }
  });
  it("定義に無い値は例外にする", () => {
    assert.throws(() => validateEntityAnnotation(kImage, { ...kEmpty, looksChild: 'teen' as any }), /Invalid looks_child/);
    assert.throws(() => validateEntityAnnotation(kImage, { ...kEmpty, medium: 'oil' as any }), /Invalid medium/);
    assert.throws(() => validateEntityAnnotation(kImage, { ...kEmpty, role: '' as any }), /Invalid role/);
  });
  it("別の entity の注釈は例外にする", () => {
    assert.throws(() => validateEntityAnnotation(kImage, { ...kEmpty, entityID: 'fedcba9876543210fedcba9876543210' }), /does not belong/);
  });
});
