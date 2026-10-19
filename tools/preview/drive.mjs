// 画面を操作しながら撮るためのひな形。一枚撮るだけなら shot.sh で足りる。
// これは「端末を回転させる」「指で歯車を回す」のように、リロードを挟まずに
// 状態を変えたいときのためのもの。
//
//   docker run --rm --network host \
//     -v "$PWD/drive.mjs:/shot/drive.mjs:ro" -v "$PWD/out:/out" \
//     gears-shot node /shot/drive.mjs http://localhost:8889/
//
// 出力は /out に置かれる。
import puppeteer from '/shot/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const url = process.argv[2] ?? 'http://localhost:8889/';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  // swiftshader を明示しないと WebGL コンテキストが取れない。
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();

// networkidle2 はアイコンが最大 300 枚あるため 30 秒では終わらず落ちる。
// domcontentloaded で開けてから、描画とテクスチャ読み込みを固定時間待つ。
const settle = (ms) => new Promise(r => setTimeout(r, ms));

// 1) 横長で読み込む
await page.setViewport({ width: 844, height: 390 });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await settle(12000);
await page.screenshot({ path: '/out/1-landscape.png' });

// 2) リロードせずに縦へ「回転」させる
await page.setViewport({ width: 390, height: 844 });
await settle(6000);
await page.screenshot({ path: '/out/2-portrait.png' });

// 3) 指で歯車を回す。マウス扱いになるので、ホバー時のツールチップも出る
//    (日付が読めるので、どの時期を見ているかの確認に使える)。
await page.mouse.move(195, 700);
await page.mouse.down();
for (let i = 0; i < 10; ++i) {
  await page.mouse.move(195 - i * 12, 700);
  await settle(30);
}
await page.mouse.up();
await settle(3000);
await page.screenshot({ path: '/out/3-dragged.png' });

// 4) 同じ向きのままリサイズ(回した位置が保たれるかの確認)
await page.setViewport({ width: 390, height: 800 });
await settle(3000);
await page.screenshot({ path: '/out/4-resized.png' });

await browser.close();
console.log('ok');
