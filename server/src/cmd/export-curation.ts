// 公開済みの moment を、studio に渡すエクスポート（#49）として tar で標準出力に書く。
//
//   node server/dist/cmd/export-curation.js > export.tar
//
// 中身は moment ごとの <YYYYMMDD-HHMMSS>/hexe.yaml・hexe.fml と、トップの index.yaml（shelf/CurationExport.ts）。
// 標準出力には tar だけを書き、ほかの表示は標準エラー出力に出す。
// 本番ではコンテナの中で動かすので、ファイルには書かない（書くとコンテナの中に残る）。
import Repo from '../repo/Repo.js';
import { exportEntries, loadExportSource, makeTar } from '../shelf/CurationExport.js';

async function main() {
  if (process.argv.length > 2) {
    throw new Error(`知らない引数です: ${process.argv.slice(2).join(' ')}`);
  }
  console.error('** Exporting curation **');
  const repo = new Repo();
  try {
    const src = await loadExportSource(repo);
    for (const id of src.missingEntityIDs) {
      console.error(`entities に無い entity: ${id}（hexe.yaml には entity だけを出します）`);
    }
    const tar = await makeTar(exportEntries(src));
    await new Promise<void>((resolve, reject) => {
      process.stdout.write(tar, (err) => (err ? reject(err) : resolve()));
    });
    console.error(`moment ${src.moments.length} 件を書き出しました（${tar.length} バイト）。`);
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
