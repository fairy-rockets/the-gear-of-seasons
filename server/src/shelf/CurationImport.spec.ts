import { describe, it } from 'mocha';
import assert from 'assert';
import dayjs from 'dayjs';

import Shelf from './Shelf.js';
import { Entity } from './Entity.js';
import { EntityAnnotation } from './EntityAnnotation.js';
import { CuratedMoment } from './Moment.js';
import {
  CurationPlan,
  CurationState,
  applyCurationPlan,
  makeCurationPlan,
  parseCurationFile,
} from './CurationImport.js';

const kA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const kB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const kC = 'cccccccccccccccccccccccccccccccc';
const kT1 = '2017-07-26T02:46:00+09:00';
const kT2 = '2018-01-02T03:04:05+09:00';
const kT3 = '2019-05-06T07:08:09+09:00';

const kImageA: Entity = {
  type: 'image', id: kA, mediumID: 'm', iconID: 'i', timestamp: undefined, mimeType: 'image/png', width: 1, height: 1,
};
const kVideoB: Entity = {
  type: 'video', id: kB, iconID: 'i', timestamp: undefined, mimeType: 'video/mp4', width: 1, height: 1, duration: 1,
};
const kAudioC: Entity = {
  type: 'audio', id: kC, iconID: 'i', timestamp: undefined, mimeType: 'audio/mpeg', duration: 1,
};

function annotation(entityID: string, values: Partial<EntityAnnotation> = {}): EntityAnnotation {
  return {
    entityID, medium: null, alt: null, description: null, tags: null, palette: null, characters: null,
    looksNude: null, looksChild: null, looksNote: null, checked: false, role: null, roleGroup: null, roleStar: null, roleNote: null,
    ...values,
  };
}

function moment(t: string, text: string, values: Partial<CuratedMoment> = {}): CuratedMoment {
  return {
    timestamp: dayjs(t), title: 't', author: 'a', text, iconID: undefined, status: 'published',
    tier: 'archive', series: [], sensitive: false, sensitiveManual: false,
    ...values,
  };
}

// loadCurationState の代わり。autoSensitiveMoments は sensitive_manual = false のもの全部にする
// （本文に entity を含むかどうかは makeCurationPlan が確かめる）。
function state(moments: CuratedMoment[], entities: Entity[], annotations: EntityAnnotation[] = []): CurationState {
  return {
    moments: new Map(moments.map((m) => [m.timestamp!!.valueOf(), m])),
    entities: new Map(entities.map((e) => [e.id, e])),
    annotations: new Map(annotations.map((a) => [a.entityID, a])),
    autoSensitiveMoments: moments.filter((m) => !m.sensitiveManual),
  };
}

function parse(src: string) {
  const { file, errors } = parseCurationFile(src);
  assert.deepStrictEqual(errors, []);
  return file;
}

function plan(src: string, s: CurationState, overwrite = false): CurationPlan {
  return makeCurationPlan(parse(src), s, { overwrite });
}

// 計画を書いたあとの DB を、state の上で作る（applyCurationPlan と saveEntityAnnotation がすることを写したもの）。
function applyToState(s: CurationState, p: CurationPlan) {
  for (const e of p.entities) {
    s.annotations.set(e.entity.id, e.annotation);
  }
  for (const a of p.autoSensitive) {
    s.moments.get(a.timestamp.valueOf())!!.sensitive = a.to;
  }
  for (const m of p.moments) {
    const cur = s.moments.get(m.timestamp.valueOf())!!;
    cur.tier = m.tier;
    cur.series = m.series;
    if (m.sensitive !== null) {
      cur.sensitive = m.sensitive;
      cur.sensitiveManual = true;
    }
  }
  s.autoSensitiveMoments = [...s.moments.values()].filter((m) => !m.sensitiveManual);
}

describe("parseCurationFile", () => {
  it("moment を文字列のまま読み、項目を EntityAnnotation の名前にする", () => {
    const { file, errors } = parseCurationFile(`
moments:
  - moment: ${kT1}
    tier: pickup
    series: [夏]
    sensitive: false
    media:
      - entity: ${kA}
        looks_nude: none
        looks_note: ""
        checked: true
        tags: []
`);
    assert.deepStrictEqual(errors, []);
    assert.strictEqual(file.moments.length, 1);
    const m = file.moments[0];
    assert.strictEqual(m.label, kT1);
    assert.ok(m.timestamp.isSame(dayjs(kT1)));
    assert.strictEqual(m.tier, 'pickup');
    assert.deepStrictEqual(m.series, ['夏']);
    assert.strictEqual(m.sensitive, false);
    assert.deepStrictEqual(m.media, [{
      entityID: kA,
      fields: [
        { key: 'looks_nude', field: 'looksNude', value: 'none' },
        { key: 'looks_note', field: 'looksNote', value: '' },
        { key: 'checked', field: 'checked', value: true },
        { key: 'tags', field: 'tags', value: [] },
      ],
    }]);
  });
  it("YAML の重複キーはエラー", () => {
    const { errors } = parseCurationFile(`
moments:
  - moment: ${kT1}
    tier: pickup
    tier: sketch
`);
    assert.strictEqual(errors.length, 1);
  });
  it("エラーは最初の1つで止めずに全部集める", () => {
    const { file, errors } = parseCurationFile(`
version: 1
moments:
  - moment: ${kT1}
    tier: featured
    series: 夏
    sensitive_manual: true
    media:
      - entity: ${kA}
        looks_nude: naked
        checked: yes
        role_star: null
        colour: red
        toString: x
`);
    assert.deepStrictEqual(errors, [
      '知らないキーです: version',
      `moment ${kT1}: tier: 定義に無い値です: "featured"`,
      `moment ${kT1}: series: 文字列のリストではありません: "夏"`,
      `moment ${kT1}: 知らないキーです: sensitive_manual`,
      `moment ${kT1} entity ${kA}: looks_nude: 定義に無い値です: "naked"`,
      `moment ${kT1} entity ${kA}: checked: true か false ではありません: "yes"`,
      `moment ${kT1} entity ${kA}: role_star が null です`,
      `moment ${kT1} entity ${kA}: 知らないキーです: colour`,
      `moment ${kT1} entity ${kA}: 知らないキーです: toString`,
    ]);
    // エラーのあった項目は落とす。
    assert.deepStrictEqual(file.moments[0].media[0].fields, []);
  });
  it("明示的な null はエラー", () => {
    const { errors } = parseCurationFile(`
moments:
  - moment: ${kT1}
    tier: null
    series: ~
    media:
      - entity: ${kA}
        alt:
`);
    assert.deepStrictEqual(errors, [
      `moment ${kT1}: tier が null です`,
      `moment ${kT1}: series が null です`,
      `moment ${kT1} entity ${kA}: alt が null です`,
    ]);
  });
  it("オフセットの無い moment や、md5 でない entity はエラー", () => {
    const { errors } = parseCurationFile(`
moments:
  - moment: 2017-07-26T02:46:00
  - moment: ${kT1}
    media:
      - entity: 12345678901234567890123456789012
      - entity: ${kA.toUpperCase()}
`);
    assert.strictEqual(errors.length, 3);
    assert.match(errors[0], /^moments\[0\]: moment がオフセット付きの時刻/);
    assert.match(errors[1], /media\[0\]: entity が md5/);
    assert.match(errors[2], /media\[1\]: entity が md5/);
  });
  it("同じ moment（書き方が違っても同じ時刻）や、同じ moment の下の同じ entity はエラー", () => {
    const { errors } = parseCurationFile(`
moments:
  - moment: ${kT1}
    media:
      - entity: ${kA}
      - entity: ${kA}
  - moment: 2017-07-25T17:46:00Z
`);
    assert.deepStrictEqual(errors, [
      `moment ${kT1} entity ${kA}: 同じ moment の下に同じ entity が2回出てきます`,
      `moment 2017-07-25T17:46:00Z: 同じ moment が2回出てきます（${kT1}）`,
    ]);
  });
  it("別の moment の下の同じ entity は、値が同じなら通し、違えばエラー", () => {
    const same = parseCurationFile(`
moments:
  - moment: ${kT1}
    media: [{ entity: ${kA}, alt: 海, checked: true }]
  - moment: ${kT2}
    media: [{ entity: ${kA}, checked: true, alt: 海 }]
`);
    assert.deepStrictEqual(same.errors, []);
    const differ = parseCurationFile(`
moments:
  - moment: ${kT1}
    media: [{ entity: ${kA}, alt: 海 }]
  - moment: ${kT2}
    media: [{ entity: ${kA}, alt: 山 }]
`);
    assert.deepStrictEqual(differ.errors, [`moment ${kT2} entity ${kA}: moment ${kT1} の下にも出てきて、値が違います`]);
  });
});

describe("makeCurationPlan の検査", () => {
  it("DB に無い moment、本文に無い entity、entities に無い entity、種類に合わない項目はエラー", () => {
    const s = state([
      moment(kT1, `[image entity="${kA}"][link entity="${kB}" text="元"][audio entity="${kC}"]`),
      moment(kT2, `[video entity="${kB}"]`),
    ], [kImageA, kAudioC]);
    const p = plan(`
moments:
  - moment: ${kT3}
  - moment: ${kT1}
    media:
      - { entity: ${kB}, alt: 動画 }
      - { entity: ${kC}, alt: 音, looks_nude: none, checked: true }
  - moment: ${kT2}
    media:
      - { entity: ${kB}, alt: 動画 }
`, s);
    assert.deepStrictEqual(p.errors, [
      `moment ${kT3}: DB にありません`,
      `moment ${kT1} entity ${kB}: その moment の本文の [image]・[video]・[audio] にありません`,
      `moment ${kT1} entity ${kC}: audio の entity が持たない項目です: looks_nude, checked`,
      `moment ${kT2} entity ${kB}: entities にありません`,
    ]);
  });
  it("音声の alt・description・tags と、checked: false は通す", () => {
    const s = state([moment(kT1, `[audio entity="${kC}"]`)], [kAudioC]);
    const p = plan(`
moments:
  - moment: ${kT1}
    media: [{ entity: ${kC}, alt: 波の音, description: 浜辺, tags: [海], checked: false }]
`, s);
    assert.deepStrictEqual(p.errors, []);
    assert.deepStrictEqual(p.entities[0].changes.map((c) => c.key), ['alt', 'description', 'tags']);
  });
});

describe("makeCurationPlan の計画", () => {
  it("書いていない項目は今の値のまま残す", () => {
    const s = state([moment(kT1, `[image entity="${kA}"]`)], [kImageA], [
      annotation(kA, { alt: '海', role: 'grab', checked: true }),
    ]);
    const p = plan(`
moments:
  - moment: ${kT1}
    media: [{ entity: ${kA}, medium: drawing, looks_note: "" }]
`, s);
    assert.deepStrictEqual(p.errors, []);
    assert.deepStrictEqual(p.entities[0].changes, [
      { key: 'medium', from: null, to: 'drawing', overwrite: false },
      { key: 'looks_note', from: null, to: '', overwrite: false },
    ]);
    assert.deepStrictEqual(p.entities[0].annotation, annotation(kA, { alt: '海', role: 'grab', checked: true, medium: 'drawing', looksNote: '' }));
  });
  it("値があって違うものは衝突にして書かず、ほかの項目は書く", () => {
    const s = state([moment(kT1, `[image entity="${kA}"]`)], [kImageA], [
      annotation(kA, { role: 'grab', tags: [] }),
    ]);
    const p = plan(`
moments:
  - moment: ${kT1}
    media: [{ entity: ${kA}, role: deep, tags: [海], alt: 海 }]
`, s);
    assert.deepStrictEqual(p.conflicts, [
      { momentLabel: kT1, entityID: kA, key: 'role', current: 'grab', file: 'deep' },
      // 空のリストは series と違って既定値ではなく、値として扱う。
      { momentLabel: kT1, entityID: kA, key: 'tags', current: [], file: ['海'] },
    ]);
    assert.deepStrictEqual(p.entities[0].annotation, annotation(kA, { role: 'grab', tags: [], alt: '海' }));
  });
  it("--overwrite なら衝突も上書きする", () => {
    const s = state([moment(kT1, `[image entity="${kA}"]`, { tier: 'pickup' })], [kImageA], [annotation(kA, { role: 'grab' })]);
    const p = plan(`
moments:
  - moment: ${kT1}
    tier: sketch
    media: [{ entity: ${kA}, role: deep }]
`, s, true);
    assert.deepStrictEqual(p.conflicts, []);
    assert.deepStrictEqual(p.moments[0].changes, [{ key: 'tier', from: 'pickup', to: 'sketch', overwrite: true }]);
    assert.deepStrictEqual(p.entities[0].changes, [{ key: 'role', from: 'grab', to: 'deep', overwrite: true }]);
    assert.strictEqual(p.entities[0].annotation.role, 'deep');
  });
  it("tier = archive と series = [] は未入力とみなす", () => {
    const p1 = plan(`
moments:
  - moment: ${kT1}
    tier: pickup
    series: [夏]
`, state([moment(kT1, '')], []));
    assert.deepStrictEqual(p1.conflicts, []);
    assert.deepStrictEqual(p1.moments[0].changes.map((c) => c.key), ['tier', 'series']);
    assert.strictEqual(p1.moments[0].tier, 'pickup');
    assert.deepStrictEqual(p1.moments[0].series, ['夏']);
    assert.strictEqual(p1.moments[0].tierOrSeriesChanged, true);

    const p2 = plan(`
moments:
  - moment: ${kT1}
    tier: archive
    series: []
`, state([moment(kT1, '', { tier: 'pickup', series: ['夏'] })], []));
    assert.deepStrictEqual(p2.moments, []);
    assert.deepStrictEqual(p2.conflicts.map((c) => c.key), ['tier', 'series']);
  });
  it("tier だけ変わるときも、series は今の値で書く", () => {
    const p = plan(`
moments:
  - moment: ${kT1}
    tier: pickup
`, state([moment(kT1, '', { series: ['夏'] })], []));
    assert.strictEqual(p.moments[0].tier, 'pickup');
    assert.deepStrictEqual(p.moments[0].series, ['夏']);
  });
  it("checked は false を未入力とみなし、true → false だけを衝突にする", () => {
    const s = state([moment(kT1, `[image entity="${kA}"][video entity="${kB}"]`)], [kImageA, kVideoB], [
      annotation(kA, { checked: false }),
      annotation(kB, { checked: true }),
    ]);
    const p = plan(`
moments:
  - moment: ${kT1}
    media:
      - { entity: ${kA}, checked: true }
      - { entity: ${kB}, checked: false }
`, s);
    assert.deepStrictEqual(p.entities.map((e) => [e.entity.id, e.changes]), [
      [kA, [{ key: 'checked', from: false, to: true, overwrite: false }]],
    ]);
    assert.deepStrictEqual(p.conflicts, [{ momentLabel: kT1, entityID: kB, key: 'checked', current: true, file: false }]);
  });
  it("sensitive は、自動の moment なら値が同じでも手での上書きにし、手で上書き済みなら違うときだけ衝突にする", () => {
    const s = state([
      moment(kT1, '', { sensitive: false, sensitiveManual: false }),
      moment(kT2, '', { sensitive: true, sensitiveManual: true }),
      moment(kT3, '', { sensitive: true, sensitiveManual: true }),
    ], []);
    const src = `
moments:
  - moment: ${kT1}
    sensitive: false
  - moment: ${kT2}
    sensitive: true
  - moment: ${kT3}
    sensitive: false
`;
    const p = plan(src, s);
    assert.deepStrictEqual(p.moments.map((m) => [m.label, m.sensitive, m.tierOrSeriesChanged]), [[kT1, false, false]]);
    assert.deepStrictEqual(p.conflicts, [{ momentLabel: kT3, entityID: null, key: 'sensitive', current: true, file: false }]);
    const o = plan(src, s, true);
    assert.deepStrictEqual(o.moments.map((m) => [m.label, m.sensitive]), [[kT1, false], [kT3, false]]);
    assert.deepStrictEqual(o.conflicts, []);
  });
  it("looks_* を書くと計算し直される sensitive を出す（ファイルに無い moment も、手で上書きする moment は除く）", () => {
    const s = state([
      moment(kT1, `[image entity="${kA}"]`),
      moment(kT2, `[image entity="${kA}"]`),
      moment(kT3, `[image entity="${kA}"]`),
    ], [kImageA]);
    const p = plan(`
moments:
  - moment: ${kT1}
    media: [{ entity: ${kA}, looks_nude: nude, looks_child: child }]
  - moment: ${kT3}
    sensitive: false
`, s);
    assert.deepStrictEqual(p.autoSensitive.map((a) => [a.timestamp.format(), a.from, a.to]), [
      [dayjs(kT1).format(), false, true],
      [dayjs(kT2).format(), false, true],
    ]);
  });
  it("値の変わらない entity は計画に入れず、sensitive も計算し直さない", () => {
    // 保存されている sensitive が食い違っていても、注釈を書かないなら計算し直されない（saveEntityAnnotation と同じ）。
    const s = state([moment(kT1, `[image entity="${kA}"]`)], [kImageA], [annotation(kA, { looksNude: 'nude', looksChild: 'child' })]);
    const p = plan(`
moments:
  - moment: ${kT1}
    media: [{ entity: ${kA}, looks_nude: nude }]
`, s);
    assert.deepStrictEqual(p.entities, []);
    assert.deepStrictEqual(p.autoSensitive, []);
  });
  it("同じファイルで2回目は変更 0 件", () => {
    const s = state([
      moment(kT1, `[image entity="${kA}"][video entity="${kB}"]`),
      moment(kT2, `[audio entity="${kC}"]`, { tier: 'pickup', sensitive: true, sensitiveManual: true }),
    ], [kImageA, kVideoB, kAudioC], [annotation(kB, { role: 'grab' })]);
    const src = `
moments:
  - moment: ${kT1}
    tier: pickup
    series: [夏, 海]
    media:
      - { entity: ${kA}, medium: drawing, tags: [海], looks_nude: nude, looks_child: child, checked: true, role_star: false }
      - { entity: ${kB}, role: deep, alt: 波 }
  - moment: ${kT2}
    tier: sketch
    sensitive: false
    media:
      - { entity: ${kC}, alt: 波の音 }
`;
    const first = plan(src, s);
    assert.deepStrictEqual(first.errors, []);
    assert.notStrictEqual(first.entities.length, 0);
    assert.notStrictEqual(first.conflicts.length, 0);
    applyToState(s, first);
    const second = plan(src, s);
    assert.deepStrictEqual([second.moments, second.entities, second.autoSensitive], [[], [], []]);
    // 衝突は書いていないので、2回目も同じものが出る。
    assert.deepStrictEqual(second.conflicts, first.conflicts);
  });
});

describe("applyCurationPlan", () => {
  it("注釈を書いてから、tier・series と sensitive の上書きを書く。変わらないものは呼ばない", async () => {
    const s = state([
      moment(kT1, `[image entity="${kA}"]`),
      moment(kT2, ''),
    ], [kImageA]);
    const p = plan(`
moments:
  - moment: ${kT1}
    sensitive: true
    media: [{ entity: ${kA}, alt: 海 }]
  - moment: ${kT2}
    series: [夏]
`, s);
    const calls: unknown[][] = [];
    const shelf = new Proxy({}, {
      get: (_target, name) => async (...args: unknown[]) => {
        calls.push([name, ...args.map((a) => dayjs.isDayjs(a) ? a.format() : a)]);
      },
    }) as Shelf;
    await applyCurationPlan(shelf, p);
    assert.deepStrictEqual(calls, [
      ['saveEntityAnnotation', annotation(kA, { alt: '海' })],
      ['overrideMomentSensitive', dayjs(kT1).format(), true],
      ['updateMomentCuration', dayjs(kT2).format(), 'archive', ['夏']],
    ]);
  });
  it("エラーのある計画は書かない", async () => {
    const p = plan(`
moments:
  - moment: ${kT1}
`, state([], []));
    await assert.rejects(applyCurationPlan({} as Shelf, p));
  });
});
