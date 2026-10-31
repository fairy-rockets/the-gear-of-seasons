import { describe, it } from 'mocha';
import assert from 'assert';
import dayjs from 'dayjs';

import MomentRenderer from './MomentRenderer.js';
import { Moment, MomentSummary } from '../shelf/Moment.js';
import { Entity } from '../shelf/Entity.js';
import Shelf from '../shelf/Shelf.js';
import { EntityAnnotation } from '../shelf/EntityAnnotation.js';

describe("MomentRenderer.renderNavigationFooter", () => {
  it("prev/next 両方ある場合はリンクになる", () => {
    const prev: MomentSummary = {
      timestamp: dayjs('2020-01-01 00:00:00'),
      title: 'まえの絵',
      iconID: 'aaa',
      status: 'published',
    };
    const next: MomentSummary = {
      timestamp: dayjs('2020-01-03 00:00:00'),
      title: 'つぎの絵',
      iconID: 'bbb',
      status: 'published',
    };
    const html = MomentRenderer.renderNavigationFooter(prev, next);
    assert.ok(html.includes('<a class="moment-footer-prev" href="/2020/01/01/00:00:00/" title="まえの絵">← まえの絵</a>'));
    assert.ok(html.includes('<a class="moment-footer-next" href="/2020/01/03/00:00:00/" title="つぎの絵">つぎの絵 →</a>'));
    assert.ok(html.includes('<a class="moment-footer-gear" href="/">歯車にもどる</a>'));
    assert.ok(html.includes('<a href="/pickup/">🏮 えらんだ絵をみる</a>'));
    assert.ok(html.includes('<a href="/shop/">お店</a>'));
  });

  it("prev/next が無い場合は disabled な span になる", () => {
    const html = MomentRenderer.renderNavigationFooter(null, null);
    assert.ok(html.includes('<span class="moment-footer-prev disabled">← まえの絵</span>'));
    assert.ok(html.includes('<span class="moment-footer-next disabled">つぎの絵 →</span>'));
    assert.ok(!html.includes('moment-footer-prev"'));
    assert.ok(!html.includes('moment-footer-next"'));
  });

  it("title に含まれる HTML はエスケープされる", () => {
    const prev: MomentSummary = {
      timestamp: dayjs('2020-01-01 00:00:00'),
      title: '<script>alert(1)</script>',
      iconID: 'aaa',
      status: 'published',
    };
    const html = MomentRenderer.renderNavigationFooter(prev, null);
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });
});

describe("MomentRenderer.render", () => {
  const entities: Entity[] = [
    {
      type: 'image',
      id: 'img',
      mediumID: 'img-medium',
      iconID: 'img-icon',
      mimeType: 'image/jpeg',
      timestamp: undefined,
      width: 4000,
      height: 3000,
    },
    {
      type: 'video',
      id: 'vid',
      iconID: 'vid-icon',
      mimeType: 'video/mp4',
      timestamp: undefined,
      width: 640,
      height: 480,
      duration: 10,
    },
    {
      type: 'audio',
      id: 'aud',
      iconID: 'aud-icon',
      mimeType: 'audio/mpeg',
      timestamp: undefined,
      duration: 10,
    },
  ];
  // render が使う Shelf の読み取りだけを用意し、DB を立てずに済ませる。
  const shelf = {
    findEntity: async (id: string) => {
      if (id === 'img2') return { ...entities[0], id };
      return entities.find((e) => e.id === id) ?? null;
    },
    findEntityAnnotations: async () => new Map<string, EntityAnnotation>(),
  } as unknown as Shelf;
  const render = (text: string, renderer = new MomentRenderer(shelf)) => {
    const moment: Moment = {
      timestamp: dayjs('2020-01-01 00:00:00'),
      title: 'title',
      author: 'author',
      text: text,
      iconID: undefined,
      status: 'published',
      tier: 'archive',
      series: [],
      sensitive: false,
      sensitiveManual: false,
    };
    return renderer.render(dayjs('2020-01-02 00:00:00'), moment);
  };

  const annotation = (alt: string | null, humanVerified = true): EntityAnnotation => ({
    entityID: 'img', medium: null, alt, description: null, tags: null, palette: null,
    characters: null, looksNude: null, looksChild: null, looksNote: null, humanVerified,
    role: null, roleGroup: null, roleStar: null, roleNote: null,
  });
  const annotatedRenderer = (values: EntityAnnotation[], calls: string[][] = []) => new MomentRenderer({
    ...shelf,
    findEntityAnnotations: async (ids: string[]) => {
      calls.push(ids);
      return new Map(values.map((value) => [value.entityID, value]));
    },
  } as unknown as Shelf);

  it("確認済みの画像注釈の alt を元の空白を保って表示する", async () => {
    const html = await render('[image entity="img"]', annotatedRenderer([annotation('  季節の絵  ')]));
    assert.ok(html.includes('alt="  季節の絵  "'), html);
  });

  for (const [name, values] of [
    ['未確認', [annotation('非公開の説明', false)]],
    ['null', [annotation(null)]],
    ['空文字', [annotation('')]],
    ['空白のみ', [annotation(' \t\n　')]],
    ['注釈なし', []],
  ] as [string, EntityAnnotation[]][]) {
    it(`${name}の場合は従来の alt を使う`, async () => {
      const html = await render('[image entity="img"]', annotatedRenderer(values));
      assert.ok(html.includes('alt="an image."'), html);
      assert.ok(!html.includes('非公開の説明'), html);
    });
  }

  it("alt を属性としてエスケープする", async () => {
    const html = await render('[image entity="img"]', annotatedRenderer([annotation('"<絵>&')]));
    assert.ok(html.includes('alt="&quot;&lt;絵&gt;&amp;"'), html);
  });

  it("画像 ID のみ重複を除いて一度に注釈を取得する", async () => {
    const calls: string[][] = [];
    const html = await render('[image entity="img"][video entity="vid"][image entity="img2"][image entity="img"][audio entity="aud"][image]',
      annotatedRenderer([annotation('画像の説明')], calls));
    assert.deepStrictEqual(calls, [['img', 'img2']]);
    assert.strictEqual(html.split('alt="画像の説明"').length - 1, 2);
    assert.ok(html.includes('alt="an image."'), html);
  });

  it("画像 ID がなければ注釈を取得せず、他のメディアの出力も変えない", async () => {
    const calls: string[][] = [];
    const text = '[video entity="vid"][audio entity="aud"][link entity="img"][image]';
    const html = await render(text, annotatedRenderer([annotation('画像の説明')], calls));
    assert.deepStrictEqual(calls, []);
    assert.strictEqual(html, await render(text));
    assert.ok(!html.includes('aria-label'), html);
  });

  it("同じ renderer の並行描画で注釈が混ざらない", async () => {
    let call = 0;
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const renderer = new MomentRenderer({
      ...shelf,
      findEntityAnnotations: async () => {
        call++;
        return new Map([['img', annotation(call === 1 ? '最初の説明' : '次の説明')]]);
      },
      findEntity: async (id: string) => {
        await firstBlocked;
        return shelf.findEntity(id);
      },
    } as unknown as Shelf);
    const first = render('[image entity="img"]', renderer);
    const second = render('[image entity="img"]', renderer);
    releaseFirst();
    const [firstHTML, secondHTML] = await Promise.all([first, second]);
    assert.ok(firstHTML.includes('alt="最初の説明"'), firstHTML);
    assert.ok(secondHTML.includes('alt="次の説明"'), secondHTML);
  });

  it("画像は medium を表示し、元画像へはリンクしない", async () => {
    const html = await render('[image entity="img"]');
    assert.ok(html.includes('src="/entity/img/medium"'));
    assert.ok(!html.includes('href="/entity/img"'));
    assert.ok(!html.includes('<a '));
  });

  it("画像に link= があればそこへリンクする", async () => {
    const html = await render('[image entity="img" link="https://example.com/"]');
    assert.ok(html.includes('<a href="https://example.com/"'));
    assert.ok(html.includes('src="/entity/img/medium"'));
  });

  it("画像の link= はエスケープされる", async () => {
    const html = await render('[image entity="img" link="https://example.com/?a=1&b=2"]');
    assert.ok(html.includes('<a href="https://example.com/?a=1&amp;b=2"'));
  });

  it("動画は元ファイルを再生元にし、再生できないブラウザ向けに元ファイルへのリンクを残す", async () => {
    const html = await render('[video entity="vid"]');
    assert.ok(html.includes('src="/entity/vid"'));
    assert.ok(html.includes('<a href="/entity/vid">Click to play.</a>'));
  });

  it("音声は元ファイルを再生元にする", async () => {
    const html = await render('[audio entity="aud"]');
    assert.ok(html.includes('src="/entity/aud"'));
  });

  it("画像・動画・音声の要素に、entity の id と種類を data 属性で付ける", async () => {
    const html = await render('[image entity="img" link="https://example.com/"][video entity="vid"][audio entity="aud"]');
    assert.ok(/<img [^>]*data-entity="img" data-type="image"/.test(html), html);
    assert.ok(/<video [^>]*data-entity="vid" data-type="video"/.test(html), html);
    assert.ok(/<audio [^>]*data-entity="aud" data-type="audio"/.test(html), html);
    // 画像を包むリンクやほかの要素には付けない。
    assert.strictEqual(html.split('data-entity=').length - 1, 3, html);
  });

  it("[link] ブロックは元ファイルへリンクする", async () => {
    const html = await render('[link entity="img" text="[フルサイズ]"]');
    assert.ok(html.includes('<a href="/entity/img"'));
    assert.ok(html.includes('>[フルサイズ]</a>'));
  });
});
