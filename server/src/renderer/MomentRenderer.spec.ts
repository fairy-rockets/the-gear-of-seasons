import { describe, it } from 'mocha';
import assert from 'assert';
import dayjs from 'dayjs';

import MomentRenderer from './MomentRenderer.js';
import { MomentSummary } from '../shelf/Moment.js';

describe("MomentRenderer.renderNavigationFooter", () => {
  it("prev/next 両方ある場合はリンクになる", () => {
    const prev: MomentSummary = {
      timestamp: dayjs('2020-01-01 00:00:00'),
      title: 'まえの絵',
      iconID: 'aaa',
    };
    const next: MomentSummary = {
      timestamp: dayjs('2020-01-03 00:00:00'),
      title: 'つぎの絵',
      iconID: 'bbb',
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
    };
    const html = MomentRenderer.renderNavigationFooter(prev, null);
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });
});
