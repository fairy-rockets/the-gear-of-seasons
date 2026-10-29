// DB が正本なので、普段は使わない。値をまとめて書き換えたいときには便利。
// 保守が重くなったら、shelf/CurationImport.ts と一緒に消してよい（ほかに依存するものはない）。
//
// studio が書き出した投入用ファイル（#43）のキュレーションの項目を DB に入れる。
//
//   node server/dist/cmd/import-curation.js <投入用ファイル | -> [--apply] [--overwrite]
//
// ファイルに - を渡すと標準入力から読む（本番ではファイルをコンテナにコピーせずに流し込める）。
// 既定では計画（変わる値・衝突・件数）を出すだけで、DB は変えない。--apply を付けたときだけ、1つのトランザクションで書く。
// 衝突（DB に値があり、ファイルの値と違う）は書かずに一覧に出す。--overwrite を付けたときだけ上書きする。
// ファイルにエラーが1つでもあれば、何も書かずに終了コード 1 で終わる。
import * as fs from 'fs/promises';

import Repo from '../repo/Repo.js';
import Shelf from '../shelf/Shelf.js';
import { formatMomentPath } from '../shelf/Moment.js';
import {
  CurationFile,
  CurationPlan,
  FieldChange,
  applyCurationPlan,
  loadCurationState,
  makeCurationPlan,
  parseCurationFile,
} from '../shelf/CurationImport.js';

async function readInput(path: string): Promise<string> {
  if (path !== '-') {
    return await fs.readFile(path, 'utf-8');
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function formatValue(v: unknown): string {
  if (v === null) {
    return '(なし)';
  }
  if (typeof v === 'string' || Array.isArray(v)) {
    return JSON.stringify(v);
  }
  return String(v);
}

function formatChange(c: FieldChange): string {
  const notes = [...(c.overwrite ? ['上書き'] : []), ...(c.note !== undefined ? [c.note] : [])];
  const suffix = notes.length > 0 ? `（${notes.join('。')}）` : '';
  return `${c.key}: ${formatValue(c.from)} → ${formatValue(c.to)}${suffix}`;
}

function printPlan(file: CurationFile, plan: CurationPlan) {
  console.log('[変更]');
  if (plan.moments.length === 0 && plan.entities.length === 0) {
    console.log('(なし)');
  }
  for (const fm of file.moments) {
    const mp = plan.moments.find((m) => m.label === fm.label);
    const eps = plan.entities.filter((e) => e.momentLabel === fm.label);
    if (mp === undefined && eps.length === 0) {
      continue;
    }
    console.log(`moment ${fm.label} ${formatMomentPath(fm.timestamp)}`);
    for (const c of mp?.changes ?? []) {
      console.log(`  ${formatChange(c)}`);
    }
    for (const e of eps) {
      console.log(`  entity ${e.entity.id} [${e.entity.type}]`);
      for (const c of e.changes) {
        console.log(`    ${formatChange(c)}`);
      }
    }
  }
  console.log();

  console.log('[計算し直されて変わる sensitive]（自動の moment。注釈を書いたあとと、moment を書くときに計算し直す）');
  if (plan.autoSensitive.length === 0) {
    console.log('(なし)');
  }
  for (const s of plan.autoSensitive) {
    console.log(`${formatMomentPath(s.timestamp)} ${s.from} → ${s.to}`);
  }
  console.log();

  console.log('[衝突]（DB の値 ≠ ファイルの値。書かない。--overwrite を付けると上書きする）');
  if (plan.conflicts.length === 0) {
    console.log('(なし)');
  }
  for (const c of plan.conflicts) {
    const target = c.entityID === null ? '' : ` entity ${c.entityID}`;
    console.log(`moment ${c.momentLabel}${target} ${c.key}: ${formatValue(c.current)} ≠ ${formatValue(c.file)}`);
  }
  console.log();

  const numFields = plan.moments.reduce((n, m) => n + m.changes.length, 0) + plan.entities.reduce((n, e) => n + e.changes.length, 0);
  console.log('[件数]');
  console.log(`  変更: ${numFields} 項目（moment ${plan.moments.length} 件、entity ${plan.entities.length} 件）`);
  console.log(`  計算し直されて変わる sensitive: ${plan.autoSensitive.length} 件`);
  console.log(`  衝突: ${plan.conflicts.length} 件`);
  console.log();
}

async function main() {
  const argv = process.argv.slice(2);
  let input: string | null = null;
  let apply = false;
  let overwrite = false;
  while (argv.length > 0) {
    const arg = argv.shift()!!;
    if (arg === '--apply') {
      apply = true;
    } else if (arg === '--overwrite') {
      overwrite = true;
    } else if (input === null && (arg === '-' || !arg.startsWith('-'))) {
      input = arg;
    } else {
      throw new Error(`知らない引数です: ${arg}`);
    }
  }
  if (input === null) {
    throw new Error('投入用ファイルのパスを渡してください（標準入力から読むなら -）');
  }

  console.log('** Importing curation **');
  console.log();
  const { file, errors } = parseCurationFile(await readInput(input));
  const repo = new Repo();
  try {
    // --apply のときは、今の値を読むところから同じトランザクションで行い、出した計画のとおりに書く。
    const run = async (r: Repo): Promise<boolean> => {
      const plan = makeCurationPlan(file, await loadCurationState(r, file), { overwrite });
      plan.errors.unshift(...errors);
      if (plan.errors.length > 0) {
        console.log(`[エラー] ${plan.errors.length} 件。何も書いていません。`);
        for (const err of plan.errors) {
          console.log(`  - ${err}`);
        }
        process.exitCode = 1;
        return false;
      }
      printPlan(file, plan);
      if (!apply) {
        console.log('計画を出しただけで、DB は変えていません。書き込むには --apply を付けてください。');
        return false;
      }
      await applyCurationPlan(new Shelf(r), plan);
      return true;
    };
    if (apply) {
      if (await repo.transaction(run)) {
        console.log('書き込みました（変更の無い行には書いていません）。');
      }
    } else {
      await run(repo);
    }
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
