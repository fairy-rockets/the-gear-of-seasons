// 失われたファイルを種類ごとに数え上げる。
//
//   node server/dist/cmd/list-missing.js [--out DIR]
//
// sanity-check との違い:
//   - original / medium / icon のどれが無いのかを区別する
//   - entities の行そのものが無い参照（本文だけが生き残っている絵）も見つける
//   - どの entity からも参照されていない storage のファイルも数える
// --out を渡すと、NAS から探し直すための一覧をそのディレクトリに書き出す。
import * as fs from 'fs/promises';
import * as path from 'path';

import Repo from '../repo/Repo.js';
import Shelf from '../shelf/Shelf.js';
import { Entity } from '../shelf/Entity.js';
import { formatMomentPath } from '../shelf/Moment.js';
import * as fml from '../lib/fml.js';

type Kind = 'original' | 'medium' | 'icon';
const kKinds: Kind[] = ['original', 'medium', 'icon'];

function mediumIDOf(entity: Entity): string | null {
  return entity.type === 'image' ? entity.mediumID : null;
}

// storage/<kind>/ab/cd/ef/<のこり> を辿って、実際に置かれている md5 を集める
async function enumurateStoredHashes(storagePath: string, kind: Kind): Promise<Set<string>> {
  const hashes = new Set<string>();
  const walk = async (dir: string, prefix: string): Promise<void> => {
    let items;
    try {
      items = await fs.readdir(dir, { withFileTypes: true });
    } catch (_err) {
      return;
    }
    for (const item of items) {
      if (item.isDirectory()) {
        await walk(path.join(dir, item.name), prefix + item.name);
      } else if (item.isFile()) {
        hashes.add(prefix + item.name);
      }
    }
  };
  await walk(path.join(storagePath, kind), '');
  return hashes;
}

async function main() {
  const argv = process.argv.slice(2);
  let outDir: string | null = null;
  while (argv.length > 0) {
    const arg = argv.shift()!!;
    if (arg === '--out') {
      outDir = argv.shift() ?? null;
      if (outDir === null) {
        throw new Error('--out にディレクトリを渡してください');
      }
    } else {
      throw new Error(`知らない引数です: ${arg}`);
    }
  }

  console.log('** Listing missing files **');
  console.log();
  const repo = new Repo();
  const shelf = new Shelf(repo);
  try {
    // 本文が参照している entity を、参照元の moment ごとに覚えておく
    console.log('[Checking all moments...]');
    const refs = new Map<string, Set<string>>();
    let numMoments = 0;
    for await (const moment of shelf.enumurateAllMoments()) {
      numMoments++;
      const momentPath =
        moment.timestamp !== undefined ? formatMomentPath(moment.timestamp) : '(no timestamp)';
      for (const block of fml.parse(moment.text).blocks) {
        switch (block.type) {
          case 'image':
          case 'video':
          case 'audio': {
            if (block.entity === undefined) {
              break;
            }
            const id = block.entity.toLowerCase();
            if (!refs.has(id)) {
              refs.set(id, new Set<string>());
            }
            refs.get(id)!!.add(momentPath);
            break;
          }
          default:
            break;
        }
      }
    }

    console.log('[Checking all entities...]');
    const entities = new Map<string, Entity>();
    for await (const entity of shelf.enumurateAllEntities()) {
      entities.set(entity.id, entity);
    }

    console.log('[Checking the storage...]');
    const stored = new Map<Kind, Set<string>>();
    for (const kind of kKinds) {
      stored.set(kind, await enumurateStoredHashes(shelf.storagePath, kind));
    }

    // ---- 突き合わせ ----
    const missing = new Map<Kind, Entity[]>(kKinds.map((kind) => [kind, []]));
    const used = new Map<Kind, Set<string>>(kKinds.map((kind) => [kind, new Set<string>()]));
    for (const entity of entities.values()) {
      const mediumID = mediumIDOf(entity);
      used.get('original')!!.add(entity.id);
      used.get('icon')!!.add(entity.iconID);
      if (mediumID !== null) {
        used.get('medium')!!.add(mediumID);
      }
      if (!stored.get('original')!!.has(entity.id)) {
        missing.get('original')!!.push(entity);
      }
      if (!stored.get('icon')!!.has(entity.iconID)) {
        missing.get('icon')!!.push(entity);
      }
      if (mediumID !== null && !stored.get('medium')!!.has(mediumID)) {
        missing.get('medium')!!.push(entity);
      }
    }
    const dangling = [...refs.keys()].filter((id) => !entities.has(id)).sort();
    const orphans = new Map<Kind, string[]>(
      kKinds.map((kind) => [
        kind,
        [...stored.get(kind)!!].filter((hash) => !used.get(kind)!!.has(hash)).sort(),
      ]),
    );

    // ---- 報告 ----
    console.log();
    console.log('[Current Statistics]');
    console.log('  ', `${numMoments} moments, ${entities.size} entities, ${refs.size} entities referred.`);
    for (const kind of kKinds) {
      console.log('  ', `${kind}: ${stored.get(kind)!!.size} files stored.`);
    }
    console.log();

    for (const kind of kKinds) {
      const list = missing.get(kind)!!;
      console.log(`** ${kind} が無い entity: ${list.length} **`);
      for (const entity of list.sort((a, b) => a.id.localeCompare(b.id))) {
        const where = refs.get(entity.id);
        const from = where === undefined ? '(本文から参照されていません)' : [...where].sort().join(' ');
        console.log(`  - ${entity.id} [${entity.type}] ${entity.mimeType} ${from}`);
      }
      console.log();
    }

    console.log(`** entities に行が無い参照: ${dangling.length} **`);
    for (const id of dangling) {
      console.log(`  - ${id} ${[...refs.get(id)!!].sort().join(' ')}`);
    }
    console.log();

    for (const kind of kKinds) {
      const list = orphans.get(kind)!!;
      console.log(`** どの entity からも参照されていない ${kind} のファイル: ${list.length} **`);
      for (const hash of list) {
        console.log(`  - ${hash}`);
      }
      console.log();
    }

    // ---- 探し直すための一覧 ----
    if (outDir !== null) {
      await fs.mkdir(outDir, { recursive: true });
      const write = async (name: string, lines: string[]): Promise<void> => {
        const file = path.join(outDir!!, name);
        await fs.writeFile(file, lines.map((line) => `${line}\n`).join(''));
        console.log(`  wrote ${file} (${lines.length} lines)`);
      };
      console.log('[Writing lists...]');
      // original が無いものは md5 = entity の id なので、これを元ファイル探しの手がかりにする
      const lostOriginals = missing.get('original')!!;
      await write(
        'missing-original.tsv',
        lostOriginals.map((e) => [e.id, e.type, e.mimeType].join('\t')),
      );
      await write('missing-original.md5.txt', lostOriginals.map((e) => e.id));
      // tools/restore.rs の --md5-map が読む形式（medium を持つ image だけ）
      await write(
        'missing-original.md5-map.csv',
        lostOriginals
          .filter((e) => mediumIDOf(e) !== null)
          .map((e) => `${e.id},${mediumIDOf(e)}`),
      );
      for (const kind of ['medium', 'icon'] as Kind[]) {
        await write(
          `missing-${kind}.tsv`,
          missing.get(kind)!!.map((e) => [e.id, kind === 'medium' ? mediumIDOf(e) : e.iconID, e.mimeType].join('\t')),
        );
      }
      await write('dangling-refs.tsv', dangling.map((id) => [id, [...refs.get(id)!!].sort().join(' ')].join('\t')));
      for (const kind of kKinds) {
        await write(`orphan-${kind}.txt`, orphans.get(kind)!!);
      }
      console.log();
    }
    console.log('All done!');
  } finally {
    await repo.close();
  }
}

main()
  .then(() => {})
  .catch((err) => {
    console.error(err);
    throw err;
  });
