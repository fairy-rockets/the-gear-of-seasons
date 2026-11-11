import { describe, it } from 'mocha';
import assert from 'assert';
import dayjs from 'dayjs';

import * as fml from '../lib/fml.js';
import Repo from '../repo/Repo.js';
import Shelf from './Shelf.js';
import { Entity } from './Entity.js';
import { EntityAnnotation } from './EntityAnnotation.js';
import { Moment, formatMomentTime, momentIconID } from './Moment.js';
import {
  CurationPlan,
  CurationState,
  applyCurationPlan,
  loadCurationState,
  makeCurationPlan,
  parseCurationFile,
} from './CurationImport.js';

const kA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const kB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const kC = 'cccccccccccccccccccccccccccccccc';
const kD = 'dddddddddddddddddddddddddddddddd';
const kT1 = '2017-07-26T02:46:00+09:00';
const kT2 = '2018-01-02T03:04:05+09:00';
const kT3 = '2019-05-06T07:08:09+09:00';
const kT4 = '2021-01-01T00:00:00+09:00';

const kImageA: Entity = {
  type: 'image', location: 'internal', id: kA, mediumID: 'm', iconID: 'i', timestamp: undefined, mimeType: 'image/png', width: 1, height: 1,
};
const kVideoB: Entity = {
  type: 'video', location: 'internal', id: kB, iconID: 'i', timestamp: undefined, mimeType: 'video/mp4', width: 1, height: 1, duration: 1,
};
const kAudioC: Entity = {
  type: 'audio', location: 'internal', id: kC, iconID: 'i', timestamp: undefined, mimeType: 'audio/mpeg', duration: 1,
};
const kImageD: Entity = { ...kImageA, id: kD };

function annotation(entityID: string, values: Partial<EntityAnnotation> = {}): EntityAnnotation {
  return {
    entityID, methods: null, materials: null, subject: null, alt: null, description: null, tags: null, palette: null,
    characters: null, note: null, humanVerified: false,
    ...values,
  };
}

// icon_id は、指定しなければ本文から求めた値（SAVE で書いたときと同じ）にする。
function moment(t: string, text: string, values: Partial<Moment> = {}): Moment {
  return {
    timestamp: dayjs(t), title: 't', author: 'a', text, iconID: momentIconID(fml.parse(text)), status: 'published',
    tier: 'archive', series: [], intent: null,
    ...values,
  };
}

// loadCurationState の代わり。
function state(moments: Moment[], entities: Entity[], annotations: EntityAnnotation[] = []): CurationState {
  return {
    moments: new Map(moments.map((m) => [m.timestamp!!.valueOf(), m])),
    entities: new Map(entities.map((e) => [e.id, e])),
    annotations: new Map(annotations.map((a) => [a.entityID, a])),
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

// 計画を書いたあとの DB を、state の上で作る（applyCurationPlan がすることを写したもの）。
function applyToState(s: CurationState, p: CurationPlan) {
  for (const e of p.entities) {
    s.annotations.set(e.entity.id, e.annotation);
  }
  for (const m of p.moments) {
    const cur = s.moments.get(m.timestamp.valueOf())!!;
    cur.tier = m.tier;
    cur.series = m.series;
    cur.intent = m.intent;
  }
}

describe("parseCurationFile", () => {
  it("moment を文字列のまま読み、項目を EntityAnnotation の名前にする", () => {
    const { file, errors } = parseCurationFile(`
moments:
  - moment: ${kT1}
    tier: pickup
    series: [夏]
    media:
      - entity: ${kA}
        palette: color
        note: ""
        human_verified: true
        tags: []
        methods: [generate, draw]
        subject: 海
`);
    assert.deepStrictEqual(errors, []);
    assert.strictEqual(file.moments.length, 1);
    const m = file.moments[0];
    assert.strictEqual(m.label, kT1);
    assert.ok(m.timestamp.isSame(dayjs(kT1)));
    assert.strictEqual(m.tier, 'pickup');
    assert.deepStrictEqual(m.series, ['夏']);
    assert.deepStrictEqual(m.media, [{
      entityID: kA,
      fields: [
        { key: 'palette', field: 'palette', value: 'color' },
        { key: 'note', field: 'note', value: '' },
        { key: 'human_verified', field: 'humanVerified', value: true },
        { key: 'tags', field: 'tags', value: [] },
        // methods は並びを問わず読み、kAnnotationMethods の順にそろえる。
        { key: 'methods', field: 'methods', value: ['draw', 'generate'] },
        { key: 'subject', field: 'subject', value: '海' },
      ],
    }]);
  });
  it("moment の intent と、メディアの materials を読む", () => {
    const m = parse(`
moments:
  - moment: ${kT1}
    intent: |
      海の青を見せたかった。
      二行目。
    media:
      - { entity: ${kA}, materials: [pencil, coffee] }
      - { entity: ${kB}, materials: [] }
`).moments[0];
    assert.strictEqual(m.intent, '海の青を見せたかった。\n二行目。\n');
    assert.deepStrictEqual(m.media.map((x) => x.fields), [
      [{ key: 'materials', field: 'materials', value: ['pencil', 'coffee'] }],
      [{ key: 'materials', field: 'materials', value: [] }],
    ]);
  });
  it("文字列でない intent と、文字列のリストでない materials はエラー", () => {
    const { errors } = parseCurationFile(`
moments:
  - moment: ${kT1}
    intent: [ねらい]
    media: [{ entity: ${kA}, materials: digital }]
`);
    assert.deepStrictEqual(errors, [
      `moment ${kT1}: intent: 文字列ではありません: ["ねらい"]`,
      `moment ${kT1} entity ${kA}: materials: 文字列のリストではありません: "digital"`,
    ]);
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
    media:
      - entity: ${kA}
        palette: sepia
        human_verified: yes
        note: null
        methods: []
        medium: drawing
        role_note: 主題
        colour: red
        toString: x
        checked: true
`);
    assert.deepStrictEqual(errors, [
      '知らないキーです: version',
      `moment ${kT1}: tier: 定義に無い値です: "featured"`,
      `moment ${kT1}: series: 文字列のリストではありません: "夏"`,
      `moment ${kT1} entity ${kA}: palette: 定義に無い値です: "sepia"`,
      `moment ${kT1} entity ${kA}: human_verified: true か false ではありません: "yes"`,
      `moment ${kT1} entity ${kA}: note が null です`,
      `moment ${kT1} entity ${kA}: methods: 定義に無い値です: []`,
      // medium・role_*（#95 で methods・subject・note にした）も、読み替えずに弾く。
      `moment ${kT1} entity ${kA}: 知らないキーです: medium`,
      `moment ${kT1} entity ${kA}: 知らないキーです: role_note`,
      `moment ${kT1} entity ${kA}: 知らないキーです: colour`,
      `moment ${kT1} entity ${kA}: 知らないキーです: toString`,
      // human_verified の古い名前（#58）も、読み替えずに弾く。
      `moment ${kT1} entity ${kA}: 知らないキーです: checked`,
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
    assert.match(errors[0], /^moments\[0\]: moment がオフセット付きの、存在する時刻/);
    assert.match(errors[1], /media\[0\]: entity が md5/);
    assert.match(errors[2], /media\[1\]: entity が md5/);
  });
  it("存在しない日時の moment はエラー（繰り越して読まない）", () => {
    const { errors } = parseCurationFile(`
moments:
  - moment: 2017-02-30T00:00:00+09:00
  - moment: 2017-07-26T24:00:00+09:00
  - moment: 2017-07-26T02:46:60+09:00
  - moment: 2017-07-26T02:46:00+09:60
  - moment: 2016-02-29T00:00:00+09:00
  - moment: 2017-07-25T17:46:00Z
  - moment: 2017-07-25T13:17:00-04:30
  - moment: 2017-02-29T00:00:00+09:00
  - moment: 2017-13-01T00:00:00+09:00
  - moment: 2017-07-26T25:00:00+09:00
  - moment: 2017-07-25T17:41:00+00:05
  - moment: 2017-07-25T18:02:00-00:16
  - moment: 2017-07-25T17:45:00-00:00
`);
    assert.deepStrictEqual(errors.map((e) => e.split(':')[0]), [
      'moments[0]', 'moments[1]', 'moments[2]', 'moments[3]', 'moments[7]', 'moments[8]', 'moments[9]',
    ]);
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
    media: [{ entity: ${kA}, alt: 海, human_verified: true }]
  - moment: ${kT2}
    media: [{ entity: ${kA}, human_verified: true, alt: 海 }]
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
      - { entity: ${kC}, alt: 音, palette: color, characters: [], human_verified: true }
  - moment: ${kT2}
    media:
      - { entity: ${kB}, alt: 動画 }
`, s);
    assert.deepStrictEqual(p.errors, [
      `moment ${kT3}: DB にありません`,
      `moment ${kT1} entity ${kB}: その moment の本文の [image]・[video]・[audio] にありません`,
      `moment ${kT1} entity ${kC}: audio の entity が持たない項目です: palette, characters`,
      `moment ${kT2} entity ${kB}: entities にありません`,
    ]);
  });
  it("音声の materials はエラー", () => {
    const s = state([moment(kT1, `[audio entity="${kC}"]`)], [kAudioC]);
    const p = plan(`
moments:
  - moment: ${kT1}
    media: [{ entity: ${kC}, methods: [draw], materials: [digital] }]
`, s);
    assert.deepStrictEqual(p.errors, [`moment ${kT1} entity ${kC}: audio の entity が持たない項目です: materials`]);
  });
  it("音声の methods・subject・alt・description・tags・note・human_verified は通す", () => {
    const s = state([moment(kT1, `[audio entity="${kC}"]`)], [kAudioC]);
    const p = plan(`
moments:
  - moment: ${kT1}
    media:
      - { entity: ${kC}, methods: [capture], subject: 波, alt: 波の音, description: 浜辺, tags: [海], note: 夜, human_verified: true }
`, s);
    assert.deepStrictEqual(p.errors, []);
    assert.deepStrictEqual(p.entities[0].changes.map((c) => c.key), ['methods', 'subject', 'alt', 'description', 'tags', 'note', 'human_verified']);
  });
  it("materials は、書いたあとの methods に draw を含むときだけ通す", () => {
    const s = state([
      moment(kT1, `[image entity="${kA}"][video entity="${kB}"]`),
      moment(kT2, `[image entity="${kD}"]`),
    ], [kImageA, kVideoB, kImageD], [
      annotation(kB, { methods: ['draw'] }),
      annotation(kD, { methods: ['capture'] }),
    ]);
    const p = plan(`
moments:
  - moment: ${kT1}
    media:
      - { entity: ${kA}, methods: [draw, generate], materials: [digital] }
      - { entity: ${kB}, materials: [pencil] }
  - moment: ${kT2}
    media:
      - { entity: ${kD}, methods: [draw], materials: [pencil] }
`, s);
    // kD の methods は衝突で書かないので、書いたあとも [capture] のまま。
    assert.deepStrictEqual(p.errors, [
      `moment ${kT2} entity ${kD}: materials は methods に draw を含むときだけ書けます（書いたあとの methods: ["capture"]。ファイルの methods は衝突したので書かない。--overwrite なら書く）`,
    ]);
    assert.deepStrictEqual(p.entities.map((e) => e.entity.id), [kA, kB]);
    const p2 = plan(`
moments:
  - moment: ${kT1}
    media: [{ entity: ${kA}, materials: [digital] }]
`, s);
    assert.deepStrictEqual(p2.errors, [
      `moment ${kT1} entity ${kA}: materials は methods に draw を含むときだけ書けます（書いたあとの methods: null）`,
    ]);
  });
});

describe("makeCurationPlan の計画", () => {
  it("書いていない項目は今の値のまま残す", () => {
    const s = state([moment(kT1, `[image entity="${kA}"]`)], [kImageA], [
      annotation(kA, { alt: '海', subject: '船', humanVerified: true }),
    ]);
    const p = plan(`
moments:
  - moment: ${kT1}
    media: [{ entity: ${kA}, methods: [draw], note: "" }]
`, s);
    assert.deepStrictEqual(p.errors, []);
    assert.deepStrictEqual(p.entities[0].changes, [
      { key: 'methods', from: null, to: ['draw'], overwrite: false },
      { key: 'note', from: null, to: '', overwrite: false },
    ]);
    assert.deepStrictEqual(p.entities[0].annotation, annotation(kA, { alt: '海', subject: '船', humanVerified: true, methods: ['draw'], note: '' }));
  });
  it("値があって違うものは衝突にして書かず、ほかの項目は書く", () => {
    const s = state([moment(kT1, `[image entity="${kA}"]`)], [kImageA], [
      annotation(kA, { subject: '船', tags: [] }),
    ]);
    const p = plan(`
moments:
  - moment: ${kT1}
    media: [{ entity: ${kA}, subject: 海, tags: [海], alt: 海 }]
`, s);
    assert.deepStrictEqual(p.conflicts, [
      { momentLabel: kT1, entityID: kA, key: 'subject', current: '船', file: '海' },
      // 空のリストは series と違って既定値ではなく、値として扱う。
      { momentLabel: kT1, entityID: kA, key: 'tags', current: [], file: ['海'] },
    ]);
    assert.deepStrictEqual(p.entities[0].annotation, annotation(kA, { subject: '船', tags: [], alt: '海' }));
  });
  it("--overwrite なら衝突も上書きする", () => {
    const s = state([moment(kT1, `[image entity="${kA}"]`, { tier: 'pickup' })], [kImageA], [annotation(kA, { methods: ['capture'] })]);
    const p = plan(`
moments:
  - moment: ${kT1}
    tier: sketch
    media: [{ entity: ${kA}, methods: [capture, draw] }]
`, s, true);
    assert.deepStrictEqual(p.conflicts, []);
    assert.deepStrictEqual(p.moments[0].changes, [{ key: 'tier', from: 'pickup', to: 'sketch', overwrite: true }]);
    assert.deepStrictEqual(p.entities[0].changes, [{ key: 'methods', from: ['capture'], to: ['draw', 'capture'], overwrite: true }]);
    assert.deepStrictEqual(p.entities[0].annotation.methods, ['draw', 'capture']);
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

    const p2 = plan(`
moments:
  - moment: ${kT1}
    tier: archive
    series: []
`, state([moment(kT1, '', { tier: 'pickup', series: ['夏'] })], []));
    assert.deepStrictEqual(p2.moments, []);
    assert.deepStrictEqual(p2.conflicts.map((c) => c.key), ['tier', 'series']);
  });
  it("intent は null を未入力とみなし、値があって違えば衝突、--overwrite なら上書きする", () => {
    const src = `
moments:
  - moment: ${kT1}
    intent: 新しいねらい
`;
    const p1 = plan(src, state([moment(kT1, '')], []));
    assert.deepStrictEqual(p1.conflicts, []);
    assert.deepStrictEqual(p1.moments[0].changes, [{ key: 'intent', from: null, to: '新しいねらい', overwrite: false }]);
    assert.strictEqual(p1.moments[0].intent, '新しいねらい');

    const p2 = plan(src, state([moment(kT1, '', { intent: '前のねらい' })], []));
    assert.deepStrictEqual(p2.moments, []);
    assert.deepStrictEqual(p2.conflicts, [{ momentLabel: kT1, entityID: null, key: 'intent', current: '前のねらい', file: '新しいねらい' }]);

    const p3 = plan(src, state([moment(kT1, '', { intent: '前のねらい' })], []), true);
    assert.deepStrictEqual(p3.moments[0].changes, [{ key: 'intent', from: '前のねらい', to: '新しいねらい', overwrite: true }]);
  });
  it("materials は null を未入力とみなし、空のリストは値として扱う", () => {
    const src = `
moments:
  - moment: ${kT1}
    media: [{ entity: ${kA}, materials: [digital] }]
`;
    const p1 = plan(src, state([moment(kT1, `[image entity="${kA}"]`)], [kImageA], [annotation(kA, { methods: ['draw'] })]));
    assert.deepStrictEqual(p1.entities[0].changes, [{ key: 'materials', from: null, to: ['digital'], overwrite: false }]);
    const p2 = plan(src, state([moment(kT1, `[image entity="${kA}"]`)], [kImageA], [annotation(kA, { methods: ['draw'], materials: [] })]));
    assert.deepStrictEqual(p2.entities, []);
    assert.deepStrictEqual(p2.conflicts, [{ momentLabel: kT1, entityID: kA, key: 'materials', current: [], file: ['digital'] }]);
  });
  it("書く moment の、本文から求め直される icon_id の変化を計画に出す", () => {
    const s = state([
      // 保存されている icon_id が、本文から求めた値と食い違っている。
      moment(kT1, `[video entity="${kB}"][image entity="${kA}"]`, { iconID: kB }),
      moment(kT2, ''),
      // 値が変わらないので、書かない。
      moment(kT3, ''),
    ], [kImageA, kVideoB]);
    const p = plan(`
moments:
  - moment: ${kT1}
    tier: pickup
  - moment: ${kT2}
    tier: pickup
  - moment: ${kT3}
    tier: archive
`, s);
    assert.deepStrictEqual(p.moments.map((m) => [m.label, m.changes.map((c) => [c.key, c.from, c.to])]), [
      [kT1, [['tier', 'archive', 'pickup'], ['icon_id', kB, kA]]],
      [kT2, [['tier', 'archive', 'pickup']]],
    ]);
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
  it("human_verified は false を未入力とみなし、true → false だけを衝突にする", () => {
    const s = state([moment(kT1, `[image entity="${kA}"][video entity="${kB}"]`)], [kImageA, kVideoB], [
      annotation(kA, { humanVerified: false }),
      annotation(kB, { humanVerified: true }),
    ]);
    const p = plan(`
moments:
  - moment: ${kT1}
    media:
      - { entity: ${kA}, human_verified: true }
      - { entity: ${kB}, human_verified: false }
`, s);
    assert.deepStrictEqual(p.entities.map((e) => [e.entity.id, e.changes]), [
      [kA, [{ key: 'human_verified', from: false, to: true, overwrite: false }]],
    ]);
    assert.deepStrictEqual(p.conflicts, [{ momentLabel: kT1, entityID: kB, key: 'human_verified', current: true, file: false }]);
  });
  it("値の変わらない entity は計画に入れない", () => {
    const s = state([moment(kT1, `[image entity="${kA}"]`)], [kImageA], [annotation(kA, { palette: 'color', subject: '海' })]);
    const p = plan(`
moments:
  - moment: ${kT1}
    media: [{ entity: ${kA}, palette: color }]
`, s);
    assert.deepStrictEqual(p.entities, []);
  });
  it("同じファイルで2回目は変更 0 件", () => {
    const s = state([
      moment(kT1, `[image entity="${kA}"][video entity="${kB}"]`),
      moment(kT2, `[audio entity="${kC}"]`, { tier: 'pickup' }),
    ], [kImageA, kVideoB, kAudioC], [annotation(kB, { subject: '船' })]);
    const src = `
moments:
  - moment: ${kT1}
    tier: pickup
    series: [夏, 海]
    media:
      - { entity: ${kA}, methods: [generate, draw], materials: [digital], tags: [海], palette: color, human_verified: true }
      - { entity: ${kB}, subject: 波, alt: 波 }
  - moment: ${kT2}
    tier: sketch
    media:
      - { entity: ${kC}, alt: 波の音 }
`;
    const first = plan(src, s);
    assert.deepStrictEqual(first.errors, []);
    assert.notStrictEqual(first.entities.length, 0);
    assert.notStrictEqual(first.conflicts.length, 0);
    applyToState(s, first);
    const second = plan(src, s);
    assert.deepStrictEqual([second.moments, second.entities], [[], []]);
    // 衝突は書いていないので、2回目も同じものが出る。
    assert.deepStrictEqual(second.conflicts, first.conflicts);
  });
});

describe("applyCurationPlan", () => {
  it("注釈を書いてから、moment ごとに今の値を読み、計画で変わる項目だけを差し替えて updateMoment（SAVE と同じ口）で書く", async () => {
    const moments = [
      // intent は計画に無いので、今の値のまま書く。
      moment(kT1, `[image entity="${kA}"]`, { title: '海', series: ['夏'], intent: 'もとのねらい' }),
      moment(kT2, '', { status: 'draft' }),
      moment(kT3, ''),
    ];
    const p = plan(`
moments:
  - moment: ${kT1}
    tier: pickup
    media: [{ entity: ${kA}, alt: 海 }]
  - moment: ${kT2}
    series: [冬]
    intent: 冬のねらい
  - moment: ${kT3}
    tier: sketch
`, state(moments, [kImageA]));
    const calls: unknown[][] = [];
    const shelf = new Proxy({}, {
      get: (_target, name) => async (...args: unknown[]) => {
        calls.push([name, ...args.map((a) => dayjs.isDayjs(a) ? a.format() : a)]);
        if (name === 'findMoment') {
          return moments.find((m) => m.timestamp!!.isSame(args[0] as dayjs.Dayjs)) ?? null;
        }
      },
    }) as Shelf;
    await applyCurationPlan(shelf, p);
    const date = (t: string) => formatMomentTime(dayjs(t));
    assert.deepStrictEqual(calls, [
      ['saveEntityAnnotation', annotation(kA, { alt: '海' })],
      ['findMoment', dayjs(kT1).format(), 'all'],
      ['updateMoment', {
        title: '海', originalDate: date(kT1), date: date(kT1), author: 'a', text: `[image entity="${kA}"]`, status: 'published',
        tier: 'pickup', series: ['夏'], intent: 'もとのねらい',
      }],
      ['findMoment', dayjs(kT2).format(), 'all'],
      ['updateMoment', {
        title: 't', originalDate: date(kT2), date: date(kT2), author: 'a', text: '', status: 'draft',
        tier: 'archive', series: ['冬'], intent: '冬のねらい',
      }],
      ['findMoment', dayjs(kT3).format(), 'all'],
      ['updateMoment', {
        title: 't', originalDate: date(kT3), date: date(kT3), author: 'a', text: '', status: 'published',
        tier: 'sketch', series: [], intent: null,
      }],
    ]);
  });
  it("書く moment が読めなければ例外にする", async () => {
    const p = plan(`
moments:
  - moment: ${kT1}
    tier: pickup
`, state([moment(kT1, '')], []));
    const shelf = new Proxy({}, { get: () => async () => null }) as Shelf;
    await assert.rejects(applyCurationPlan(shelf, p), /Moment not found/);
  });
  it("エラーのある計画は書かない", async () => {
    const p = plan(`
moments:
  - moment: ${kT1}
`, state([], []));
    await assert.rejects(applyCurationPlan({} as Shelf, p));
  });
});

// loadCurationState と applyCurationPlan を、DB の代わりに配列で持つ Repo で見る。
// Shelf.spec.ts の FakeRepo と同じく必要なメソッドだけを持つが、書いた値を自分の状態に反映する
// （書いたあとに読み直して、計画の予測と比べるため）。
class StateRepo {
  readonly annotations: Map<string, EntityAnnotation>;
  constructor(readonly entities: Entity[], readonly moments: Moment[], annotations: EntityAnnotation[] = []) {
    this.annotations = new Map(annotations.map((a) => [a.entityID, a]));
  }
  async findMoment(timestamp: dayjs.Dayjs) {
    return this.moments.find((m) => m.timestamp!!.isSame(timestamp)) ?? null;
  }
  async findEntity(id: string) {
    return this.entities.find((e) => e.id === id) ?? null;
  }
  async findEntityAnnotations(ids: string[]) {
    return new Map([...this.annotations].filter(([id]) => ids.includes(id)));
  }
  async upsertEntityAnnotation(a: EntityAnnotation) {
    this.annotations.set(a.entityID, a);
  }
  // 読み直したときに書いた値が見えるよう、置き換えずに今のオブジェクトに重ねる。
  async updateMoment(old: dayjs.Dayjs, m: Moment) {
    Object.assign((await this.findMoment(old))!!, m);
    return true;
  }
}

describe("loadCurationState", () => {
  it("ファイルの moment・entity と、その注釈を読む", async () => {
    const inFile = moment(kT1, `[image entity="${kA}"]`);
    const other = moment(kT2, `[image entity="${kA}"]`);
    const repo = new StateRepo([kImageA], [inFile, other], [
      annotation(kA, { alt: '海' }),
      annotation(kB, { alt: '関係ない' }),
    ]);
    const file = parse(`
moments:
  - moment: ${kT1}
    media: [{ entity: ${kA}, alt: 海 }]
  - moment: 2001-01-01T00:00:00+09:00
`);
    const s = await loadCurationState(repo as unknown as Repo, file);
    assert.deepStrictEqual([...s.moments.values()], [inFile]);
    assert.deepStrictEqual([...s.entities.keys()], [kA]);
    assert.deepStrictEqual([...s.annotations.keys()], [kA]);
  });
});

describe("applyCurationPlan で書いた結果", () => {
  it("Shelf を通して書いた項目が、計画の予測と一致し、読み直すと変更 0 件になる", async () => {
    const kD = 'dddddddddddddddddddddddddddddddd';
    const kImageD: Entity = { ...kImageA, id: kD };
    const repo = new StateRepo([kImageA, kVideoB, kImageD], [
      moment(kT1, `[image entity="${kA}"][video entity="${kB}"]`),
      moment(kT3, `[image entity="${kD}"]`),
      // 保存されている icon_id（なし）が、本文から求めた値（C）と食い違っている moment。
      // 注釈は書かないが、tier を書くと SAVE と同じ口を通るので、求め直される。
      moment(kT4, `[audio entity="${kC}"]`, { iconID: undefined }),
    ], [annotation(kD, { alt: '星' })]);
    const src = `
moments:
  - moment: ${kT1}
    tier: pickup
    media:
      - { entity: ${kA}, palette: color, characters: [ナギ] }
      - { entity: ${kB}, alt: 波 }
  - moment: ${kT3}
    media:
      - { entity: ${kD}, palette: monochrome }
  - moment: ${kT4}
    tier: sketch
`;
    const file = parse(src);
    const p = makeCurationPlan(file, await loadCurationState(repo as unknown as Repo, file), { overwrite: false });
    assert.deepStrictEqual(p.errors, []);
    const before = new Map(repo.moments.map((m) => [m.timestamp!!.format(), { ...m }]));
    await applyCurationPlan(new Shelf(repo as unknown as Repo), p);

    // icon_id が変わった moment が、計画の icon_id の変更とちょうど一致する。
    const changedIcon = new Map<string, unknown>();
    for (const m of repo.moments) {
      const t = m.timestamp!!.format();
      if (m.iconID !== before.get(t)!!.iconID) {
        changedIcon.set(t, m.iconID ?? null);
      }
    }
    const plannedIcon = new Map<string, unknown>();
    for (const m of p.moments) {
      for (const c of m.changes.filter((c) => c.key === 'icon_id')) {
        plannedIcon.set(m.timestamp.format(), c.to);
      }
    }
    assert.deepStrictEqual(changedIcon, plannedIcon);
    assert.deepStrictEqual([...plannedIcon.keys()], [dayjs(kT4).format()]);
    assert.strictEqual((await repo.findMoment(dayjs(kT1)))!!.tier, 'pickup');
    assert.strictEqual((await repo.findMoment(dayjs(kT4)))!!.tier, 'sketch');
    for (const e of p.entities) {
      assert.deepStrictEqual(repo.annotations.get(e.entity.id), e.annotation);
    }

    const again = makeCurationPlan(file, await loadCurationState(repo as unknown as Repo, file), { overwrite: false });
    assert.deepStrictEqual([again.errors, again.moments, again.entities, again.conflicts], [[], [], [], []]);
  });
});
