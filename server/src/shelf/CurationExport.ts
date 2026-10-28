import dayjs from 'dayjs';
import { Document as YamlDocument } from 'yaml';
import * as tar from 'tar-stream';

import * as fml from '../lib/fml.js';
import Repo from '../repo/Repo.js';
import { Entity } from './Entity.js';
import { EntityAnnotation, kFieldsByType } from './EntityAnnotation.js';
import { CuratedMoment, formatMomentPath } from './Moment.js';
import { formatMomentLabel, kMediaKeys, toJST } from './CurationFormat.js';

// studio に渡すエクスポート（#49）を作る。cmd/export-curation.ts から使う。
// 公開済みの moment ごとに <YYYYMMDD-HHMMSS>/hexe.yaml と hexe.fml を、トップに index.yaml を書いた tar。
// 形は #2 のコメント（issuecomment-3603）の「4. エクスポートのコマンド」と #49。
// 同じ DB からは同じバイト列を作る（studio の git の差分を、DB で変わったところだけにするため）。
// キーとリストの順を固定し、生成日時は入れず、tar のヘッダの時刻・所有者・パーミッションも固定する。

// url の基準。Config.OmoteOrigin は開発環境では http://localhost:8889 になり、同じ DB でも環境で出力が変わるので使わない。
const kOrigin = 'https://hexe.net';

const kHeader = ' hexe からエクスポートしたもの。手で編集しない';

// YAML は core スキーマで書く（投入の parseCurationFile と同じ）。行を折り返さず、改行を含む文字列は | のブロックにする。
function stringifyYaml(value: unknown): string {
  const doc = new YamlDocument(value, { schema: 'core' });
  doc.commentBefore = kHeader;
  return doc.toString({ lineWidth: 0, blockQuote: 'literal' });
}

// tar の中の moment のディレクトリ名。timestamp を JST で書いたもの。
export function momentDirName(timestamp: dayjs.Dayjs): string {
  return toJST(timestamp).format('YYYYMMDD-HHmmss');
}

export function momentURL(timestamp: dayjs.Dayjs): string {
  return `${kOrigin}${formatMomentPath(toJST(timestamp))}`;
}

// 本文の [image]・[video]・[audio] の entity。出てくる順に、同じ entity は1回だけ。
export function mediaEntityIDs(doc: fml.Document): string[] {
  const ids = new Set<string>();
  for (const block of doc.blocks) {
    if ((block.type === 'image' || block.type === 'video' || block.type === 'audio') && block.entity !== undefined) {
      ids.add(block.entity);
    }
  }
  return [...ids];
}

export type MarkdownRef = {
  url: string;
  repo?: string;
  ref?: string;
  path?: string;
};

// [markdown url=…] の URL を、git のホスティングの raw の URL として分解する。分解できなければ url だけ。
// ref にスラッシュは含まれない前提で、最初の1段を ref、残りを path とする（URL だけでは ref と path の境目が決まらないため）。
// path はデコードせず、URL に書かれたまま出す。
export function parseMarkdownURL(url: string): MarkdownRef {
  let u: URL;
  try {
    u = new URL(url);
  } catch (_err) {
    return { url };
  }
  if (u.protocol !== 'https:' || u.search !== '' || u.hash !== '') {
    return { url };
  }
  const segments = u.pathname.split('/').slice(1);
  if (segments.some((s) => s === '')) {
    return { url };
  }
  // https://raw.githubusercontent.com/<owner>/<repo>/<ref>/<path...>
  if (u.host === 'raw.githubusercontent.com' && segments.length >= 4) {
    const [owner, repo, ref, ...path] = segments;
    return { url, repo: `github.com/${owner}/${repo}`, ref, path: path.join('/') };
  }
  // Forgejo: https://code.ledyba.org/<owner>/<repo>/raw/branch/<ref>/<path...>
  if (u.host === 'code.ledyba.org' && segments.length >= 6 && segments[2] === 'raw' && segments[3] === 'branch') {
    const [owner, repo, , , ref, ...path] = segments;
    return { url, repo: `${u.host}/${owner}/${repo}`, ref, path: path.join('/') };
  }
  return { url };
}

// 本文の [markdown] の URL。出てくる順に、同じ URL は1回だけ。
export function markdownURLs(doc: fml.Document): string[] {
  const urls = new Set<string>();
  for (const block of doc.blocks) {
    if (block.type === 'markdown' && block.url !== undefined) {
      urls.add(block.url);
    }
  }
  return [...urls];
}

// メディア1つ分。entities に行が無い entity（失われたメディア）は entity だけを出す。
// 注釈は、その種類が持たない項目と、値の無い項目（null）を出さない。空の文字列や空のリストは出す。
// 注釈の行が無い entity は、すべて未入力（checked は列の既定値の false）として扱う。
function mediaItem(id: string, entities: ReadonlyMap<string, Entity>, annotations: ReadonlyMap<string, EntityAnnotation>): Record<string, unknown> {
  const item: Record<string, unknown> = { entity: id };
  const entity = entities.get(id);
  if (entity === undefined) {
    return item;
  }
  item['type'] = entity.type;
  if (entity.type === 'image' || entity.type === 'video') {
    item['width'] = entity.width;
    item['height'] = entity.height;
  }
  if (entity.type === 'video' || entity.type === 'audio') {
    item['duration'] = entity.duration;
  }
  const annotation = annotations.get(id);
  const fields = kFieldsByType[entity.type];
  for (const [key, [field]] of Object.entries(kMediaKeys)) {
    if (!fields.includes(field)) {
      continue;
    }
    const v = annotation !== undefined ? annotation[field] : (field === 'checked' ? false : null);
    if (v !== null) {
      item[key] = v;
    }
  }
  return item;
}

// moment 1つ分の hexe.yaml の中身。キーはこの順に出す。
export function hexeYamlObject(
  m: CuratedMoment,
  entities: ReadonlyMap<string, Entity>,
  annotations: ReadonlyMap<string, EntityAnnotation>,
): Record<string, unknown> {
  const timestamp = m.timestamp!!;
  const doc = fml.parse(m.text);
  const obj: Record<string, unknown> = {
    moment: formatMomentLabel(timestamp),
    url: momentURL(timestamp),
    title: m.title,
    created: toJST(timestamp).format('YYYY-MM-DD'),
    author: m.author,
    status: m.status,
    tier: m.tier,
    series: m.series,
    sensitive: m.sensitive,
    sensitive_manual: m.sensitiveManual,
  };
  if (m.iconID !== undefined) {
    obj['icon'] = m.iconID;
  }
  obj['media'] = mediaEntityIDs(doc).map((id) => mediaItem(id, entities, annotations));
  const markdown = markdownURLs(doc).map(parseMarkdownURL);
  if (markdown.length > 0) {
    obj['markdown'] = markdown;
  }
  return obj;
}

export type ExportSource = {
  // 公開済みの moment を timestamp の順に。
  moments: CuratedMoment[];
  // moments の本文の [image]・[video]・[audio] の entity のうち、entities に行があるもの。
  entities: Map<string, Entity>;
  annotations: Map<string, EntityAnnotation>;
  // 本文にあって entities に行が無い entity（hexe.yaml には entity だけを出す）。
  missingEntityIDs: string[];
};

// 読むだけなので、トランザクションにはしない（READ COMMITTED では、トランザクションにしても文をまたいだ一貫性は無い）。
export async function loadExportSource(repo: Repo): Promise<ExportSource> {
  const moments: CuratedMoment[] = [];
  for await (const m of repo.enumurateAllMoments()) {
    if (m.status === 'published') {
      moments.push(m);
    }
  }
  moments.sort((a, b) => a.timestamp!!.valueOf() - b.timestamp!!.valueOf());
  const ids = new Set<string>();
  for (const m of moments) {
    for (const id of mediaEntityIDs(fml.parse(m.text))) {
      ids.add(id);
    }
  }
  const entities = new Map<string, Entity>();
  const missingEntityIDs: string[] = [];
  for (const id of ids) {
    const entity = await repo.findEntity(id);
    if (entity !== null) {
      entities.set(id, entity);
    } else {
      missingEntityIDs.push(id);
    }
  }
  const annotations = await repo.findEntityAnnotations([...ids]);
  return { moments, entities, annotations, missingEntityIDs };
}

export type ExportEntry = {
  name: string;
  content: string;
};

// tar に入れるファイル。名前の順（コードポイントの順。localeCompare はロケールで変わるので使わない）。
export function exportEntries(src: ExportSource): ExportEntry[] {
  const entries: ExportEntry[] = [];
  const index: { moment: string, title: string }[] = [];
  for (const m of src.moments) {
    const dir = momentDirName(m.timestamp!!);
    entries.push({ name: `${dir}/hexe.yaml`, content: stringifyYaml(hexeYamlObject(m, src.entities, src.annotations)) });
    entries.push({ name: `${dir}/hexe.fml`, content: m.text });
    index.push({ moment: formatMomentLabel(m.timestamp!!), title: m.title });
  }
  entries.push({ name: 'index.yaml', content: stringifyYaml({ moments: index }) });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (let i = 1; i < entries.length; i++) {
    // 秒より細かい違いしかない moment があると、ディレクトリ名がぶつかる。
    if (entries[i - 1].name === entries[i].name) {
      throw new Error(`[FIXME] Duplicate entry: ${entries[i].name}`);
    }
  }
  return entries;
}

// tar のヘッダの、名前と大きさのほかは固定値にする。
export const kTarHeader = {
  type: 'file',
  mode: 0o644,
  mtime: new Date(0),
  uid: 0,
  gid: 0,
  uname: '',
  gname: '',
} as const;

export async function makeTar(entries: ExportEntry[]): Promise<Buffer> {
  const pack = tar.pack();
  const chunks: Buffer[] = [];
  const done = (async () => {
    for await (const chunk of pack) {
      chunks.push(chunk as Buffer);
    }
  })();
  for (const e of entries) {
    const body = Buffer.from(e.content, 'utf-8');
    await new Promise<void>((resolve, reject) => {
      pack.entry({ ...kTarHeader, name: e.name, size: body.length }, body, (err) => (err ? reject(err) : resolve()));
    });
  }
  pack.finalize();
  await done;
  return Buffer.concat(chunks);
}
