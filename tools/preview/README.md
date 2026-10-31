# プレビューを撮る

本番のデータを使って、ブランチの見た目を**自分の目で**確かめるための道具。
omote は WebGL なので、ユニットテストでは何も分からない。実装したら一度撮る。

Issue #6(スマホのレイアウト変更)で実際に効いた: 初回の実装は縦長で画面が真っ暗に
なっていたが、横長では無症状だったため、撮っていなければスマホだけ壊れた状態で
出すところだった(原因は循環 import で定数が NaN になっていた)。

## 1. 開発環境を起こす

開発マシン(rinn)で、本番から同期したデータの上に開発環境を起こす(手順はリポジトリ直下の
`CLAUDE.md` の "Development environment")。

```sh
make sync-from-prod   # 初回、またはデータを新しくしたいとき
make dev-up
```

リポジトリがまるごと `/app` にバインドされているので、`client/dist` も `_assets` もそのまま
コンテナから見える。CSS やテンプレートはディスクから読まれるので保存すれば次のリクエストから
反映され、client を変えたら `make dev-shell` の中で `(cd client && npm run build)` すればよい。

**ホスト名に注意。** 表示は `req.hostname === OMOTE_HOST` で振り分けられ、Fastify の
`req.hostname` はポートを含まない。開発環境は `OMOTE_HOST=localhost` なので
`http://localhost:8889/` で開く(`http://127.0.0.1:8889/` は 404)。

## 2. 撮る

開発環境と同じマシン(rinn)で `shot.sh` を動かす。

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
make dev-down
docker rmi gears-shot   # 撮影用のイメージも要らなくなったら
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

## ura の未保存入力の確認

`editor-unsaved.mjs` は、ビルドした editor bundle を Chromium で動かし、初期状態・各入力欄・
再読み込み／移動／タブを閉じる際の確認・保存の成功／失敗／通信中の追加入力・moment と注釈の
独立した保存・DELETE の確認と一覧への移動を検証する。API はスクリプト内で置き換え、DB に書き込まない。

`compose.dev.yml` の `app-dev` で client をビルドした後、リポジトリのルートから実行する:

```sh
docker run --rm -v "$PWD:/app:ro" gears-shot node /app/tools/preview/editor-unsaved.mjs
```
