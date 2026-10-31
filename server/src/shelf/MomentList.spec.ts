import { describe, it } from 'mocha';
import assert from 'assert';
import dayjs from 'dayjs';

import * as fml from '../lib/fml.js';
import * as protocol from '../lib/protocol.js';
import Repo from '../repo/Repo.js';
import Shelf from './Shelf.js';
import { EntityAnnotation } from './EntityAnnotation.js';
import { Moment, MomentVisibility } from './Moment.js';
import { momentBodyText, momentListItem, momentMedia } from './MomentList.js';

const kImage = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const kVideo = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const kAudio = 'cccccccccccccccccccccccccccccccc';
const kImage2 = 'dddddddddddddddddddddddddddddddd';

const kEmpty = protocol.emptyAnnotationValues();

function annotation(entityID: string, values: Partial<protocol.AnnotationValues>): EntityAnnotation {
  return { entityID, ...kEmpty, ...values };
}

function annotations(...list: EntityAnnotation[]): Map<string, EntityAnnotation> {
  return new Map(list.map((a) => [a.entityID, a]));
}

function moment(text: string, status: Moment['status'] = 'published'): Moment {
  return {
    timestamp: dayjs('2024-11-14T13:18:23+09:00'), title: '題', author: '宵宮ナギ', text, iconID: kImage, status,
    tier: 'pickup', series: ['癒し'], sensitive: true, sensitiveManual: false,
  };
}

function item(text: string, as: Map<string, EntityAnnotation>): protocol.Moment.List.Item {
  const m = moment(text);
  return momentListItem(m, fml.parse(m.text), as);
}

describe("annotationState", () => {
  it("項目がすべて null なら未入力", () => {
    assert.strictEqual(protocol.annotationState('image', kEmpty), 'unentered');
    assert.strictEqual(protocol.annotationState('audio', kEmpty), 'unentered');
  });
  it("画像・動画は、何か入っていれば human_verified で未確認か確認済み", () => {
    assert.strictEqual(protocol.annotationState('image', { ...kEmpty, alt: '' }), 'unverified');
    assert.strictEqual(protocol.annotationState('video', { ...kEmpty, alt: 'a', humanVerified: true }), 'verified');
  });
  it("human_verified だけが true でも、未入力ではない", () => {
    assert.strictEqual(protocol.annotationState('image', { ...kEmpty, humanVerified: true }), 'verified');
  });
  it("音声は、何か入っていれば入力済み", () => {
    assert.strictEqual(protocol.annotationState('audio', { ...kEmpty, tags: [] }), 'entered');
  });
  it("音声が持たない項目だけが入っていても、音声は未入力", () => {
    assert.strictEqual(protocol.annotationState('audio', { ...kEmpty, medium: 'photo' }), 'unentered');
  });
});

describe("momentMedia", () => {
  it("[image]・[video]・[audio] を出てくる順に、同じ entity は1回だけ、ブロックの型と返す", () => {
    const doc = fml.parse(`[image entity="${kImage}"]\n[audio entity="${kAudio}"]\n[image entity="${kImage}"]\n[video entity="${kVideo}"]\n[link url="https://hexe.net/"]`);
    assert.deepStrictEqual(momentMedia(doc), [
      { entity: kImage, type: 'image' },
      { entity: kAudio, type: 'audio' },
      { entity: kVideo, type: 'video' },
    ]);
  });
});

describe("momentBodyText", () => {
  it("text ブロックと [link] の text だけをつなぎ、fml の記法は含まない", () => {
    const doc = fml.parse(`前の文\n[image entity="${kImage}"]\n[link entity="${kImage}" text="元の画像"]\n[markdown url="https://hexe.net/a.md"]\n後の文`);
    const text = momentBodyText(doc);
    assert.ok(text.includes('前の文') && text.includes('元の画像') && text.includes('後の文'), text);
    for (const w of ['image', 'entity', kImage, 'markdown', 'hexe.net']) {
      assert.ok(!text.includes(w), `${w}: ${text}`);
    }
  });
});

describe("momentListItem", () => {
  it("注釈の行が無いメディアは、画像・動画・音声とも未入力と数える", () => {
    const it = item(`[image entity="${kImage}"]\n[video entity="${kVideo}"]\n[audio entity="${kAudio}"]`, new Map());
    assert.deepStrictEqual([it.media, it.unentered, it.unverified], [3, 3, 0]);
  });
  it("未確認は画像・動画だけ。入力済みの音声と確認済みの画像は、どちらにも数えない", () => {
    const it = item(
      `[image entity="${kImage}"]\n[image entity="${kImage2}"]\n[video entity="${kVideo}"]\n[audio entity="${kAudio}"]`,
      annotations(
        annotation(kImage, { alt: 'a', humanVerified: true }),
        annotation(kImage2, { alt: 'a' }),
        annotation(kVideo, { looksNude: 'none' }),
        annotation(kAudio, { alt: 'a' }),
      ));
    assert.deepStrictEqual([it.media, it.unentered, it.unverified], [4, 0, 2]);
  });
  it("同じ entity が2回出てきても1回だけ数える", () => {
    const it = item(`[image entity="${kImage}"]\n[image entity="${kImage}"]`, new Map());
    assert.deepStrictEqual([it.media, it.unentered, it.unverified], [1, 1, 0]);
  });
  it("メディアが無ければすべて 0", () => {
    const it = item('ほんぶん', new Map());
    assert.deepStrictEqual([it.media, it.unentered, it.unverified], [0, 0, 0]);
    assert.deepStrictEqual(it.mediaByType, { image: 0, video: 0, audio: 0 });
  });
  it("型ごとの数は、同じ entity を1回だけ、最初のブロックの型で数える", () => {
    const it = item(
      `[image entity="${kImage}"]\n[image entity="${kImage2}"]\n[image entity="${kImage}"]\n` +
      `[audio entity="${kAudio}"]\n[video entity="${kAudio}"]\n[link entity="${kVideo}" text="動画"]`,
      new Map());
    assert.deepStrictEqual(it.mediaByType, { image: 2, video: 0, audio: 1 });
    assert.strictEqual(it.media, 3);
  });
  it("moment の項目をそのまま写す", () => {
    const it = item('ほんぶん', new Map());
    assert.deepStrictEqual({ ...it, media: undefined, mediaByType: undefined, unentered: undefined, unverified: undefined }, {
      path: '/2024/11/14/13:18:23/', date: '2024/11/14 13:18:23', title: '題', author: '宵宮ナギ', bodyText: 'ほんぶん',
      iconID: kImage, status: 'published', tier: 'pickup', series: ['癒し'], sensitive: true, sensitiveManual: false,
      media: undefined, mediaByType: undefined, unentered: undefined, unverified: undefined,
    });
  });
});

describe("Shelf.findMomentListItems", () => {
  it("下書きも含め、全 moment のメディアの注釈を1度にまとめて引く", async () => {
    const calls: unknown[][] = [];
    const repo = {
      async findAllMoments(v: MomentVisibility) {
        calls.push(['findAllMoments', v]);
        return [
          moment(`[image entity="${kImage}"]`, 'draft'),
          moment(`[image entity="${kImage}"]\n[audio entity="${kAudio}"]`, 'published'),
        ];
      },
      async findEntityAnnotations(ids: string[]) {
        calls.push(['findEntityAnnotations', ids]);
        return annotations(annotation(kImage, { alt: 'a' }));
      },
    };
    const items = await new Shelf(repo as unknown as Repo).findMomentListItems('all');
    assert.deepStrictEqual(calls, [['findAllMoments', 'all'], ['findEntityAnnotations', [kImage, kAudio]]]);
    assert.deepStrictEqual(items.map((it) => [it.status, it.media, it.unentered, it.unverified]), [
      ['draft', 1, 0, 1],
      ['published', 2, 1, 1],
    ]);
  });
});
