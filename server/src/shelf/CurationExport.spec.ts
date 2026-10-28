import { describe, it } from 'mocha';
import assert from 'assert';
import dayjs from 'dayjs';
import { parseDocument } from 'yaml';
import * as tar from 'tar-stream';

import Repo from '../repo/Repo.js';
import * as fml from '../lib/fml.js';
import { Entity } from './Entity.js';
import { EntityAnnotation } from './EntityAnnotation.js';
import { CuratedMoment } from './Moment.js';
import { isMomentLabel } from './CurationFormat.js';
import {
  ExportSource,
  exportEntries,
  hexeYamlObject,
  kTarHeader,
  loadExportSource,
  makeTar,
  markdownURLs,
  mediaEntityIDs,
  momentDirName,
  parseMarkdownURL,
  shortestFloat4,
} from './CurationExport.js';

const kA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const kB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const kC = 'cccccccccccccccccccccccccccccccc';
const kD = 'dddddddddddddddddddddddddddddddd';

const kImageA: Entity = {
  type: 'image', id: kA, mediumID: 'm', iconID: 'i', timestamp: undefined, mimeType: 'image/png', width: 1200, height: 1600,
};
const kVideoB: Entity = {
  type: 'video', id: kB, iconID: 'i', timestamp: undefined, mimeType: 'video/mp4', width: 1920, height: 1080, duration: 19.5,
};
const kAudioC: Entity = {
  type: 'audio', id: kC, iconID: 'i', timestamp: undefined, mimeType: 'audio/mpeg', duration: 61.25,
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
    timestamp: dayjs(t), title: '常夏の世界一周', author: '宵宮ナギ', text, iconID: kA, status: 'published',
    tier: 'archive', series: [], sensitive: false, sensitiveManual: false,
    ...values,
  };
}

function maps(entities: Entity[], annotations: EntityAnnotation[] = []) {
  return [
    new Map(entities.map((e) => [e.id, e])),
    new Map(annotations.map((a) => [a.entityID, a])),
  ] as const;
}

describe("hexeYamlObject", () => {
  it("moment の項目をこの順に出し、時刻はサーバの時間帯によらず JST で書く", () => {
    // UTC では前の日。JST では 2017-07-26 05:00:00。
    const m = moment('2017-07-25T20:00:00Z', `[image entity="${kA}"]`, {
      status: 'published', tier: 'pickup', series: ['夏', '海'], sensitive: true, sensitiveManual: true,
    });
    const obj = hexeYamlObject(m, ...maps([kImageA]));
    assert.deepStrictEqual(Object.keys(obj), [
      'moment', 'url', 'title', 'created', 'author', 'status', 'tier', 'series', 'sensitive', 'sensitive_manual', 'icon', 'media',
    ]);
    assert.deepStrictEqual({ ...obj, media: undefined }, {
      moment: '2017-07-26T05:00:00+09:00',
      url: 'https://hexe.net/2017/07/26/05:00:00/',
      title: '常夏の世界一周',
      created: '2017-07-26',
      author: '宵宮ナギ',
      status: 'published',
      tier: 'pickup',
      series: ['夏', '海'],
      sensitive: true,
      sensitive_manual: true,
      icon: kA,
      media: undefined,
    });
    assert.strictEqual(momentDirName(m.timestamp!!), '20170726-050000');
  });

  it("moment は投入（#43）の検査を通る形で、読み直すと同じ時刻になる", () => {
    for (const t of ['2017-07-25T20:00:00Z', '2017-07-26T02:46:00+09:00', '2020-02-29T23:59:59-05:00']) {
      const label = hexeYamlObject(moment(t, ''), ...maps([]))['moment'] as string;
      assert.ok(isMomentLabel(label), label);
      assert.ok(label.endsWith('+09:00'), label);
      assert.ok(dayjs(label).isSame(dayjs(t)), label);
    }
  });

  it("icon の無い moment は icon を出さず、メディアが無ければ media は空のリスト、[markdown] が無ければ markdown を出さない", () => {
    const obj = hexeYamlObject(moment('2017-07-26T02:46:00+09:00', '本文だけ', { iconID: undefined }), ...maps([]));
    assert.ok(!('icon' in obj));
    assert.ok(!('markdown' in obj));
    assert.deepStrictEqual(obj['media'], []);
  });

  it("media は [image]・[video]・[audio] の出てくる順に、同じ entity は1回だけ。[link] は数えない", () => {
    const text = [
      `[link entity="${kD}" text="元の画像"]`,
      `[audio entity="${kC}"]`,
      `[image entity="${kA}"]`,
      `[video entity="${kB}"]`,
      `[image entity="${kA}" link="https://example.com/"]`,
    ].join('\n\n');
    const obj = hexeYamlObject(moment('2017-07-26T02:46:00+09:00', text), ...maps([kImageA, kVideoB, kAudioC]));
    assert.deepStrictEqual((obj['media'] as { entity: string }[]).map((m) => m.entity), [kC, kA, kB]);
  });

  it("type・width・height・duration は entities から取り、width・height は画像・動画だけ、duration は動画・音声だけ", () => {
    const text = `[image entity="${kA}"][video entity="${kB}"][audio entity="${kC}"]`;
    const media = hexeYamlObject(moment('2017-07-26T02:46:00+09:00', text), ...maps([kImageA, kVideoB, kAudioC]))['media'];
    assert.deepStrictEqual(media, [
      { entity: kA, type: 'image', width: 1200, height: 1600, checked: false },
      { entity: kB, type: 'video', width: 1920, height: 1080, duration: 19.5, checked: false },
      { entity: kC, type: 'audio', duration: 61.25 },
    ]);
  });

  it("注釈は種類が持つ項目だけを #2 の順に出し、null は出さず、空の文字列・空のリスト・false は出す", () => {
    const full: Partial<EntityAnnotation> = {
      medium: 'drawing', alt: '海', description: '一行目\n二行目\n', tags: ['海', '船'], palette: 'color', characters: [],
      looksNude: 'none', looksChild: 'child', looksNote: '', checked: true,
      role: 'grab', roleGroup: '空の青', roleStar: false, roleNote: '',
    };
    const text = `[image entity="${kA}"][audio entity="${kC}"][video entity="${kB}"]`;
    const media = hexeYamlObject(moment('2017-07-26T02:46:00+09:00', text), ...maps([kImageA, kVideoB, kAudioC], [
      annotation(kA, full),
      // 音声の注釈の行には checked = false が入っているが、音声は checked を持たないので出さない。
      annotation(kC, { alt: '', tags: [] }),
      annotation(kB, { alt: '波', looksNude: 'partial' }),
    ]))['media'] as Record<string, unknown>[];
    assert.deepStrictEqual(Object.keys(media[0]), [
      'entity', 'type', 'width', 'height',
      'medium', 'alt', 'description', 'tags', 'palette', 'characters', 'looks_nude', 'looks_child', 'looks_note', 'checked',
      'role', 'role_group', 'role_star', 'role_note',
    ]);
    assert.deepStrictEqual(media[0], {
      entity: kA, type: 'image', width: 1200, height: 1600,
      medium: 'drawing', alt: '海', description: '一行目\n二行目\n', tags: ['海', '船'], palette: 'color', characters: [],
      looks_nude: 'none', looks_child: 'child', looks_note: '', checked: true,
      role: 'grab', role_group: '空の青', role_star: false, role_note: '',
    });
    assert.deepStrictEqual(media[1], { entity: kC, type: 'audio', duration: 61.25, alt: '', tags: [] });
    assert.deepStrictEqual(media[2], {
      entity: kB, type: 'video', width: 1920, height: 1080, duration: 19.5, alt: '波', looks_nude: 'partial', checked: false,
    });
  });

  it("entities に行が無い entity は entity だけを出す", () => {
    const media = hexeYamlObject(moment('2017-07-26T02:46:00+09:00', `[image entity="${kD}"]`), ...maps([], [annotation(kD, { alt: '海' })]))['media'];
    assert.deepStrictEqual(media, [{ entity: kD }]);
  });

  it("markdown は [markdown] の出てくる順に、同じ URL は1回だけ。raw の URL は repo・ref・path に分解する", () => {
    const text = [
      '[markdown url="https://raw.githubusercontent.com/FairyRockets/Texts/master/oreo.md"]',
      '[markdown url="https://code.ledyba.org/yoraba-taiju/white-fox-and-black-cat/raw/branch/magistra/README.md"]',
      '[markdown url="https://raw.githubusercontent.com/FairyRockets/Texts/master/oreo.md"]',
    ].join('\n\n');
    const obj = hexeYamlObject(moment('2017-07-26T02:46:00+09:00', text), ...maps([]));
    assert.deepStrictEqual(obj['markdown'], [
      {
        url: 'https://raw.githubusercontent.com/FairyRockets/Texts/master/oreo.md',
        repo: 'github.com/FairyRockets/Texts', ref: 'master', path: 'oreo.md',
      },
      {
        url: 'https://code.ledyba.org/yoraba-taiju/white-fox-and-black-cat/raw/branch/magistra/README.md',
        repo: 'code.ledyba.org/yoraba-taiju/white-fox-and-black-cat', ref: 'magistra', path: 'README.md',
      },
    ]);
    assert.strictEqual(Object.keys(obj).at(-1), 'markdown');
  });
});

describe("parseMarkdownURL", () => {
  it("開発 DB にある4件を分解する（組織名の大文字・小文字は URL のまま）", () => {
    assert.deepStrictEqual(
      [
        'https://code.ledyba.org/yoraba-taiju/white-fox-and-black-cat/raw/branch/magistra/README.md',
        'https://raw.githubusercontent.com/FairyRockets/Texts/master/blue-bird-in-the-21st-century.md',
        'https://raw.githubusercontent.com/FairyRockets/Texts/master/oreo.md',
        'https://raw.githubusercontent.com/fairy-rockets/texts/master/kitsune-to-tanuki.md',
      ].map(parseMarkdownURL).map(({ repo, ref, path }) => [repo, ref, path]),
      [
        ['code.ledyba.org/yoraba-taiju/white-fox-and-black-cat', 'magistra', 'README.md'],
        ['github.com/FairyRockets/Texts', 'master', 'blue-bird-in-the-21st-century.md'],
        ['github.com/FairyRockets/Texts', 'master', 'oreo.md'],
        ['github.com/fairy-rockets/texts', 'master', 'kitsune-to-tanuki.md'],
      ],
    );
  });
  it("path の残りの段はスラッシュでつなぐ", () => {
    assert.deepStrictEqual(parseMarkdownURL('https://raw.githubusercontent.com/o/r/main/docs/a.md'), {
      url: 'https://raw.githubusercontent.com/o/r/main/docs/a.md', repo: 'github.com/o/r', ref: 'main', path: 'docs/a.md',
    });
  });
  it("分解できない URL は url だけ", () => {
    for (const url of [
      'https://example.com/o/r/main/a.md',
      'https://raw.githubusercontent.com/o/r/main',
      'https://raw.githubusercontent.com/o/r/main/a.md?token=x',
      'http://raw.githubusercontent.com/o/r/main/a.md',
      'https://code.ledyba.org/o/r/raw/commit/0123abcd/a.md',
      'https://code.ledyba.org/o/r/src/branch/main/a.md',
      'not a url',
    ]) {
      assert.deepStrictEqual(parseMarkdownURL(url), { url });
    }
  });
});

describe("shortestFloat4", () => {
  it("float4 の値を、float4 として同じ値に戻るいちばん短い10進数にする", () => {
    assert.strictEqual(shortestFloat4(Math.fround(29.866667)), 29.866667);
    assert.strictEqual(shortestFloat4(Math.fround(68.43651)), 68.43651);
    assert.strictEqual(shortestFloat4(19.5), 19.5);
    assert.strictEqual(shortestFloat4(0), 0);
  });
  it("float4 で表せない値はそのまま", () => {
    assert.strictEqual(shortestFloat4(0.1), 0.1);
  });
});

describe("mediaEntityIDs・markdownURLs", () => {
  it("entity・url の無いブロックは数えない", () => {
    const doc = fml.parse('[image link="x"]\n\n[markdown]');
    assert.deepStrictEqual(mediaEntityIDs(doc), []);
    assert.deepStrictEqual(markdownURLs(doc), []);
  });
});

function source(moments: CuratedMoment[], entities: Entity[] = [], annotations: EntityAnnotation[] = []): ExportSource {
  const [e, a] = maps(entities, annotations);
  return { moments, entities: e, annotations: a, missingEntityIDs: [] };
}

describe("exportEntries", () => {
  it("moment ごとの hexe.yaml・hexe.fml と index.yaml を、名前の順に出す", () => {
    const m1 = moment('2017-07-26T02:46:00+09:00', '本文1\n', { title: '一' });
    const m2 = moment('2016-11-25T05:58:19+09:00', '本文2', { title: '二' });
    const entries = exportEntries(source([m2, m1]));
    assert.deepStrictEqual(entries.map((e) => e.name), [
      '20161125-055819/hexe.fml',
      '20161125-055819/hexe.yaml',
      '20170726-024600/hexe.fml',
      '20170726-024600/hexe.yaml',
      'index.yaml',
    ]);
    assert.strictEqual(entries[0].content, '本文2');
    assert.strictEqual(entries[2].content, '本文1\n');
    assert.strictEqual(entries[4].content, [
      '# hexe からエクスポートしたもの。手で編集しない',
      '',
      'moments:',
      '  - moment: 2016-11-25T05:58:19+09:00',
      '    title: 二',
      '  - moment: 2017-07-26T02:46:00+09:00',
      '    title: 一',
      '',
    ].join('\n'));
  });

  it("hexe.yaml は先頭にコメントがあり、core スキーマで読み直すと同じ値に戻る（紛らわしい文字列も文字列のまま）", () => {
    const tricky = ['', 'true', 'null', '2017-07-26', '12e34', '0123', ' 先頭が空白', '末尾が改行\n', '一行目\n二行目', '#コメントではない', 'a: b'];
    const m = moment('2017-07-26T02:46:00+09:00', `[image entity="${kA}"]`, { title: '12e34', series: tricky });
    const src = source([m], [kImageA], [annotation(kA, { tags: tricky, alt: '2017-07-26', looksNote: '', description: '一行目\n二行目\n' })]);
    const yaml = exportEntries(src).find((e) => e.name.endsWith('hexe.yaml'))!!.content;
    assert.ok(yaml.startsWith('# hexe からエクスポートしたもの。手で編集しない\n'), yaml);
    const doc = parseDocument(yaml, { schema: 'core', uniqueKeys: true });
    assert.deepStrictEqual(doc.errors, []);
    assert.deepStrictEqual(doc.toJS(), JSON.parse(JSON.stringify(hexeYamlObject(m, src.entities, src.annotations))));
  });

  it("改行を含む文字列は | のブロックで書き、長い行も折り返さない", () => {
    const long = 'あ'.repeat(200);
    const m = moment('2017-07-26T02:46:00+09:00', `[image entity="${kA}"]`, { title: long });
    const src = source([m], [kImageA], [annotation(kA, { description: '一行目\n二行目\n' })]);
    const yaml = exportEntries(src).find((e) => e.name.endsWith('hexe.yaml'))!!.content;
    assert.ok(yaml.includes(`\ntitle: ${long}\n`), yaml);
    assert.ok(yaml.includes('    description: |\n      一行目\n      二行目\n'), yaml);
  });

  it("同じ DB からは同じ内容になる", async () => {
    const make = () => source(
      [moment('2017-07-26T02:46:00+09:00', `[image entity="${kA}"]`)],
      [kImageA], [annotation(kA, { alt: '海' })],
    );
    assert.deepStrictEqual(await makeTar(exportEntries(make())), await makeTar(exportEntries(make())));
  });
});

async function extract(buf: Buffer): Promise<{ header: tar.Header, body: Buffer }[]> {
  const ex = tar.extract();
  const out: { header: tar.Header, body: Buffer }[] = [];
  const done = (async () => {
    for await (const entry of ex) {
      const chunks: Buffer[] = [];
      for await (const chunk of entry) {
        chunks.push(chunk as Buffer);
      }
      out.push({ header: entry.header, body: Buffer.concat(chunks) });
    }
  })();
  ex.end(buf);
  await done;
  return out;
}

describe("makeTar", () => {
  it("渡した順にエントリを書き、名前と大きさのほかのヘッダは固定値にする", async () => {
    const entries = [
      { name: '20170726-024600/hexe.fml', content: '日本語の本文' },
      { name: 'index.yaml', content: '' },
    ];
    const got = await extract(await makeTar(entries));
    assert.deepStrictEqual(got.map((e) => e.header.name), ['20170726-024600/hexe.fml', 'index.yaml']);
    for (const [i, e] of got.entries()) {
      const body = Buffer.from(entries[i].content, 'utf-8');
      assert.deepStrictEqual(e.body, body);
      assert.strictEqual(e.header.size, body.length);
      assert.strictEqual(e.header.type, kTarHeader.type);
      assert.strictEqual(e.header.mode, kTarHeader.mode);
      assert.strictEqual(e.header.mtime!!.getTime(), 0);
      assert.strictEqual(e.header.uid, 0);
      assert.strictEqual(e.header.gid, 0);
      assert.strictEqual(e.header.uname, '');
      assert.strictEqual(e.header.gname, '');
    }
  });
});

describe("loadExportSource", () => {
  it("公開済みの moment だけを timestamp の順に読み、本文の entity とその注釈を読む", async () => {
    const draft = moment('2018-01-01T00:00:00+09:00', `[image entity="${kB}"]`, { status: 'draft' });
    const later = moment('2019-01-01T00:00:00+09:00', `[audio entity="${kC}"][image entity="${kD}"]`);
    const earlier = moment('2017-01-01T00:00:00+09:00', `[image entity="${kA}"]`);
    const requested: string[][] = [];
    const repo = {
      async* enumurateAllMoments() {
        yield* [later, draft, earlier];
      },
      async findEntity(id: string) {
        return [kImageA, kVideoB, kAudioC].find((e) => e.id === id) ?? null;
      },
      async findEntityAnnotations(ids: string[]) {
        requested.push(ids);
        return new Map([[kA, annotation(kA, { alt: '海' })]]);
      },
    };
    const src = await loadExportSource(repo as unknown as Repo);
    assert.deepStrictEqual(src.moments, [earlier, later]);
    assert.deepStrictEqual([...src.entities.keys()], [kA, kC]);
    assert.deepStrictEqual(src.missingEntityIDs, [kD]);
    assert.deepStrictEqual(requested, [[kA, kC, kD]]);
    assert.deepStrictEqual([...src.annotations.keys()], [kA]);
  });
});
