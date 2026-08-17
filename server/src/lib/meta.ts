import * as fml from './fml.js';

import Config from '../Config.js';

// index.hbs に渡す <head> の中身。SNS のクローラは JS を実行しないので、
// ここで出す値だけがカードの見た目を決める。
export type PageMeta = {
  siteTitle: string;
  title: string;
  description: string;
  canonical: string;
  ogType: 'website' | 'article';
  ogImage: string | undefined;
  // 画像の中身の説明。og:image を出すなら出すべき、と仕様(ogp.me)に書いてある。
  ogImageAlt: string | undefined;
  publishedTime: string | undefined;
};

export const kSiteTitle = '妖精⊸ロケット :: the gear of seasons';

// Page.ts (client) が本文から組み立てるタイトルと同じ形にすること。
// ズレると SSR された title が遷移のたびに書き換わって見える。
//
// TODO: サーバとクライアントで同じ組み立てを二重に持っている。今は1箇所ずつなので
// 手で揃えているが、増えてきたら protocol.ts のように共有する場所へ移すか考える。
export function pageTitle(title: string): string {
  return `${title} :: the gear of seasons`;
}

export function absoluteURL(path: string): string {
  return `${Config.OmoteOrigin}${path}`;
}

const kMaxDescriptionLength = 120;

// text ブロックは生の HTML なので、実体参照は「HTML としてのエスケープ」の形で
// 入っている。description は Handlebars が属性値として改めてエスケープするので、
// ここで一度平文へ戻さないと "&amp;" が "&amp;amp;" になって、閲覧側に
// "&amp;" という文字列が見えてしまう。二重エスケープを防ぐための復号。
//
// 全 857 件の本文に実際に現れる実体参照は &nbsp;(17回) と &amp;(6回) の2種類だけ
// (2026-08-17 に集計)。残りの4つは同種のものが増えたときのため。
const kEntities: [RegExp, string][] = [
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#0*39;/g, "'"],
  [/&nbsp;/g, ' '],
  // &amp; は最後。先に戻すと "&amp;lt;" が "<" になってしまう。
  [/&amp;/g, '&'],
];

/**
 * moment 本文(fml)から meta description 用の平文を作る。
 *
 * text ブロックは生の HTML を含みうる(MomentRenderer が <p> で包むだけで
 * エスケープしない)ので、タグを剥いでから使う。markdown ブロックは中身が
 * 外部 URL でネットワークを踏むため、ここでは読まない。
 */
export function summarizeMomentText(text: string): string {
  const doc = fml.parse(text);
  const buff: string[] = [];
  for (const block of doc.blocks) {
    if (block.type === 'text') {
      buff.push(block.text);
    }
  }
  let plain = buff.join(' ');
  // script/style は中身がそのまま出ると壊れる(Page.ts が本文中の <script> を実行するので
  // 実際に埋め込まれている moment がある)。参考リンクの箇条書きは description に向かない
  // ので、まるごと落として本文だけを残す(残らなければ呼び出し側でタイトルに落とす)。
  plain = plain.replace(/<(script|style|ul|ol)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  plain = plain.replace(/<[^>]*>/g, ' ');
  // パースに失敗した fml タグは text ブロックとして残る(857 件中 1 件あった)。
  // 本文としては意味を持たないので description からは落とす。
  plain = plain.replace(/\[(image|video|audio|link|markdown)\b[^\]]*\]/g, ' ');
  for (const [pattern, ch] of kEntities) {
    plain = plain.replace(pattern, ch);
  }
  plain = plain.replace(/\s+/g, ' ').trim();
  if (plain.length > kMaxDescriptionLength) {
    plain = `${plain.slice(0, kMaxDescriptionLength)}…`;
  }
  return plain;
}
