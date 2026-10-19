import { describe, it } from 'mocha';
import assert from 'assert';
import dayjs from 'dayjs';

import MomentRenderer from './MomentRenderer.js';
import { Moment, MomentSummary } from '../shelf/Moment.js';
import { Entity } from '../shelf/Entity.js';
import Shelf from '../shelf/Shelf.js';

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
  ];
  // render が使うのは findEntity だけなので、DB を立てずに済ませる。
  const shelf = {
    findEntity: async (id: string) => entities.find((e) => e.id === id) ?? null,
  } as unknown as Shelf;
  const render = (text: string) => {
    const moment: Moment = {
      timestamp: dayjs('2020-01-01 00:00:00'),
      title: 'title',
      author: 'author',
      text: text,
      iconID: undefined,
      status: 'published',
    };
    return new MomentRenderer(shelf).render(dayjs('2020-01-02 00:00:00'), moment);
  };

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

  it("動画は元ファイルを再生元にするが、元ファイルへのリンクは張らない", async () => {
    const html = await render('[video entity="vid"]');
    assert.ok(html.includes('src="/entity/vid"'));
    assert.ok(!html.includes('href="/entity/vid"'));
  });
});
