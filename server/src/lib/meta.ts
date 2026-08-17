import { decode } from 'html-entities';

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

/**
 * moment 本文(fml)から meta description 用の平文を作る。
 *
 * text ブロックは生の HTML を含みうる(MomentRenderer が <p> で包むだけで
 * エスケープしない)ので、タグを剥いでから使う。markdown ブロックは中身が
 * 外部 URL でネットワークを踏むため、ここでは読まない。
 *
 * 書き間違えて fml のブロックにならなかったタグは、本文でもそのまま文字として
 * 表示される。description でも落とさず、本文の見え方に合わせる。
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
  // 実体参照を平文へ戻す。description は Handlebars が属性値として改めて
  // エスケープするので、戻さないと "&amp;" が "&amp;amp;" になって閲覧側に
  // "&amp;" という文字列が見えてしまう。復号は自前でやらず html-entities に任せる。
  // タグを剥いだ後に復号する順番は変えないこと。先に復号すると、本文に書かれた
  // "&lt;script&gt;" のような「タグに見える文字列」が本物のタグになってしまう。
  plain = decode(plain);
  plain = plain.replace(/\s+/g, ' ').trim();
  if (plain.length > kMaxDescriptionLength) {
    plain = `${plain.slice(0, kMaxDescriptionLength)}…`;
  }
  return plain;
}
