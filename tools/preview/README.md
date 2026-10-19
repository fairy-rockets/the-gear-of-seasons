# プレビューを撮る

本番のデータを使って、ブランチの見た目を**自分の目で**確かめるための道具。
omote は WebGL なので、ユニットテストでは何も分からない。実装したら一度撮る。

Issue #6(スマホのレイアウト変更)で実際に効いた: 初回の実装は縦長で画面が真っ暗に
なっていたが、横長では無症状だったため、撮っていなければスマホだけ壊れた状態で
出すところだった(原因は循環 import で定数が NaN になっていた)。

## 1. プレビューを起こす

read-only プレビューの立て方は 7io-org/compose の `the-gear-of-seasons/docs/troubleshooting-prod-preview.md` を見ること(開発環境ができるまでの例外。#30)。
撮影のために足しておくと便利なのは次の 2 つ。

- **`client/dist` を worktree からバインドマウントする。** `-v <worktree>/client/dist:/app/client/dist:ro`
  を足しておくと、`(cd client && npm run build)` するだけで反映される。定数を振って
  何度も撮るときにコンテナを作り直さずに済む。
- **`_assets` はイメージの中**なので、CSS やテンプレートを変えたら
  `docker cp _assets/static/omote/main.css <container>:/app/_assets/static/omote/main.css`。
  fastify-static はディスクから読むので、これだけで次のリクエストから反映される。

**ホスト名に注意。** 表示は `req.hostname === OMOTE_HOST` で振り分けられ、Fastify の
`req.hostname` はポートを含まない。`OMOTE_HOST=localhost` で起こしたなら
`http://localhost:8889/` で開く(`http://127.0.0.1:8889/` は 404)。

## 2. 撮る

```sh
./shot.sh http://localhost:8889/ out/portrait.png 390x844   # iPhone 相当
./shot.sh http://localhost:8889/ out/small.png    320x568   # 小さめの端末
./shot.sh http://localhost:8889/ out/landscape.png 844x390  # 横に倒したとき
```

初回は自動でイメージ(`gears-shot`)を組む。数分かかる。

操作を挟みたいときは [`drive.mjs`](./drive.mjs) を雛形にする。リロードせずに
viewport を差し替えられるので、**端末の回転**を再現できる(これが無いと、回転時に
レイアウトが追従するかを実機なしで確かめられない)。指で回す操作も送れて、マウス扱いに
なるためツールチップの日付が読める = 今どの時期を見ているかが画像から分かる。

## 3. 片付け

```sh
docker rm -f gears-preview && docker rmi gears-preview:<branch> gears-shot
```

## 踏んだ罠

- **alpine の chromium では WebGL が動かない。** SwANGLE の Vulkan 初期化に失敗し
  (`eglInitialize SwANGLE failed`)、歯車もモーメントも写らない画像が撮れる。
  `vulkan-loader` / `mesa-vulkan-swrast` を足しても直らなかった。debian の chromium を使う。
- **alpine + puppeteer は CDP がタイムアウトする**(`Network.enable` で固まる)。
  debian なら動く。
- **`waitUntil: 'networkidle2'` は使えない。** アイコンが最大 300 枚あるので既定の
  30 秒では終わらない。`domcontentloaded` + 固定待ちにする。
- **ホスト側に chromium を入れようとしない。** 依存ライブラリ(libatk など)が無く、
  入れるには root が要る。コンテナの中で完結させる。
- **公開ポート(`-p 0.0.0.0:...`)での起動は Claude Code の自動承認に弾かれる。**
  実機で見るためにポートを開けるときは、ナギに手で打ってもらうこと。
