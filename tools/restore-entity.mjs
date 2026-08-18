// restore-entity.mjs — 失われた entity を1件、正規ルート（Shelf.insertEntity）で戻す
//
//   コンテナ内で実行する:
//     docker compose exec the-gear-of-seasons node /tmp/restore-entity.mjs <file> <expected-md5>
//
//   insertEntity は id をファイルの md5 から決めるので、投入前に md5 を照合しておけば
//   本文の [image entity="..."] はそのまま生きる。medium / icon も同時に作られる。
import fs from 'node:fs/promises';

const [filePath, expectedId] = process.argv.slice(2);
if (!filePath || !expectedId) {
  console.error('usage: node restore-entity.mjs <file> <expected-md5>');
  process.exit(1);
}

const { default: Repo } = await import('file:///app/server/dist/repo/Repo.js');
const { default: Shelf } = await import('file:///app/server/dist/shelf/Shelf.js');
const { default: md5sum } = await import('file:///app/server/dist/lib/md5sum.js');

const actual = await md5sum(filePath);
if (actual !== expectedId) {
  console.error(`md5 が合いません: ${actual} (期待: ${expectedId})`);
  process.exit(1);
}
console.log(`md5 OK: ${actual}`);

const repo = new Repo();
const shelf = new Shelf(repo);
let code = 0;
try {
  const already = await shelf.findEntity(expectedId);
  if (already) {
    console.log('既に entities にあります。何もしません:');
    console.log(JSON.stringify(already, null, 2));
  } else {
    const buf = await fs.readFile(filePath);
    const entity = await shelf.insertEntity(buf);
    console.log('入りました:');
    console.log(JSON.stringify(entity, null, 2));
    if (entity.id !== expectedId) {
      console.error(`!! id が期待と違います: ${entity.id}`);
      code = 1;
    }
  }
} finally {
  await repo.close();
}
process.exit(code);
