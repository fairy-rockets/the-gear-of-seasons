# tools

失われた画像を探して戻すための道具立て。

## 1. 何がどう失われているのかを一覧にする

```sh
docker compose exec the-gear-of-seasons \
  node server/dist/cmd/list-missing.js --out /tmp/missing
```

`sanity-check` は「entities に行があるのにファイルが無い」ものだけを見るので、次の2つを見落とす。
`list-missing`（`server/src/cmd/list-missing.ts`）はそこまで数える。

- entities の行ごと失われた entity（本文の `[image entity="..."]` だけが生き残っている絵）
- どの entity からも参照されていない storage のファイル

`--out` に書き出されるもの:

| ファイル | 中身 |
|---|---|
| `missing-original.tsv` | original が無い entity（`id` / `type` / `mime`） |
| `missing-original.md5.txt` | 同じものの id だけ。id = 元ファイルの md5 なので、これがそのまま探し物のリストになる |
| `missing-original.md5-map.csv` | `original,medium` の対。`restore.rs` の `--md5-map` が読む形式（medium を持つ image のみ） |
| `missing-medium.tsv` / `missing-icon.tsv` | 派生ファイルが無い entity。original があるなら `regenerate-cache` で作り直せる |
| `dangling-refs.tsv` | entities に行が無い参照と、その参照元の moment |
| `orphan-*.txt` | どの entity からも参照されていないファイル（`gc` の対象） |

## 2. 元ファイルを探す

entity の id は元ファイルの md5 なので、写真やイラストのアーカイブを md5 で走査すれば照合できる。

```sh
./find-lost-originals.sh -w missing-original.md5.txt -o ./restore-work \
    /path/to/Works/Photos /path/to/Works/Illustrations
```

見つかったものは `restore-work/staging/<md5>` に集まるので、そのディレクトリだけを送れば済む。
アーカイブが NAS にあるなら、NAS をローカルに持っている側で走らせるほうが速い。
`-n` を付けると md5 を計算せずに走査量だけ数える。中断しても `catalog.tsv` から再開する。

`restore.rs` との使い分け:

- `find-lost-originals.sh` は md5 の完全一致だけ。bash と md5sum しか要らず、中断に強い。
- `restore.rs` は完全一致（`hash`）に加えて、ahash による近似一致（`image`）ができる。
  再エンコードされて md5 が変わってしまったものを medium と見比べて探せるのはこちらだけ。
  Rust のビルドが必要で、`hash` は見つけたファイルを **medium 側の id** のパスに書き出す。

## 3. 戻す

- **entities に行があって original だけが無い場合**: ファイルを `_storage/original/ab/cd/ef/<のこり>`
  （md5 を 2/2/2/のこり に切ったパス）に置くだけでよい。DB の行も medium/icon もそのまま生きる。
- **entities に行ごと無い場合**: `restore-entity.mjs` で入れる。md5 を照合してから
  `Shelf.insertEntity` を通すので、id は元の md5 のまま入り、medium/icon も作られ、
  本文の `[image entity="..."]` はそのまま生きる。

  ```sh
  docker cp restore-entity.mjs <container>:/tmp/
  docker cp <見つけたファイル> <container>:/tmp/target.jpg
  docker compose exec the-gear-of-seasons \
    node /tmp/restore-entity.mjs /tmp/target.jpg <md5>
  ```

  DB に書き込む唯一の手順なので、先に `make db-backup` を取っておく。
