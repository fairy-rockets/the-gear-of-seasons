#!/usr/bin/env bash
#
# find-lost-originals.sh
#
#   the gear of seasons の storage から失われた original を、
#   ローカルの写真/イラストアーカイブから md5 で探し出す。
#
#   使い方（自宅マシンで、NAS をローカルに持つ側で実行）:
#
#     ./find-lost-originals.sh -w wanted-md5.txt -o ./restore-work \
#         /path/to/Works/Photos /path/to/Works/Illustrations
#
#   オプション:
#     -w FILE   探す md5 の一覧（1行1つ・16進32桁）。必須
#     -o DIR    作業/出力ディレクトリ。必須。中断しても再開できる
#     -j N      md5 計算の並列数（既定 4）
#     -a        拡張子で絞らず全ファイルを対象にする（2周目・取りこぼし探し用）
#     -n        md5 は計算せず、対象ファイル数と総バイト数だけ数えて終わる（下見用）
#
#   出力（-o のディレクトリ）:
#     catalog.tsv        md5 <TAB> パス  … 計算済みの全ファイル。次回はこれを読んで再計算を省く
#     matched.tsv        md5 <TAB> サイズ <TAB> パス  … 見つかったもの
#     missing.txt        見つからなかった md5
#     duplicates.tsv     同じ md5 のファイルが複数あった場合の記録（情報のみ）
#     staging/<md5>      見つかったファイルの実体（ハードリンク、無理ならコピー）
#
#   終わったら staging/ をまるごと VPS に送る:
#     rsync -av --progress ./restore-work/staging/ <vps>:/tmp/gears-restore/
#
set -euo pipefail

die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
warn() { printf '\033[33mwarn:\033[0m %s\n' "$*" >&2; }
info() { printf '\033[36m==>\033[0m %s\n' "$*"; }

usage() {
  # 冒頭のコメントをそのまま使い方として出す
  awk 'NR > 1 { if (!/^#/) exit; sub(/^# ?/, ""); print }' "$0"
  exit 1
}

WANTED=""
OUT=""
JOBS=4
ALL=0
DRYRUN=0
while getopts 'w:o:j:anh' opt; do
  case "$opt" in
    w) WANTED="$OPTARG" ;;
    o) OUT="$OPTARG" ;;
    j) JOBS="$OPTARG" ;;
    a) ALL=1 ;;
    n) DRYRUN=1 ;;
    h|?) usage ;;
  esac
done
shift $((OPTIND - 1))

[ -n "$WANTED" ] || usage
[ -n "$OUT" ] || usage
[ $# -ge 1 ] || usage
[ -f "$WANTED" ] || die "md5 リストが読めません: $WANTED"

for d in "$@"; do
  [ -d "$d" ] || die "ディレクトリがありません: $d"
done

if command -v md5sum >/dev/null 2>&1; then
  MD5=md5sum
elif command -v gmd5sum >/dev/null 2>&1; then
  MD5=gmd5sum
else
  die "md5sum が見つかりません（macOS なら brew install coreutils）"
fi

mkdir -p "$OUT" "$OUT/staging"
CATALOG="$OUT/catalog.tsv"
INVENTORY="$OUT/inventory.txt"
TODO="$OUT/todo.txt"

# ---------------------------------------------------------------------------
# 0. 前回の catalog を健全化する（中断で最終行が壊れている可能性がある）
# ---------------------------------------------------------------------------
touch "$CATALOG"
if [ -s "$CATALOG" ]; then
  before=$(wc -l < "$CATALOG")
  grep -E '^[0-9a-f]{32}	' "$CATALOG" > "$CATALOG.tmp" || true
  mv "$CATALOG.tmp" "$CATALOG"
  after=$(wc -l < "$CATALOG")
  if [ "$before" -ne "$after" ]; then
    warn "catalog.tsv の壊れた行を $((before - after)) 行捨てました（前回の中断の跡）"
  fi
  info "catalog に既に $after 件"
fi

# ---------------------------------------------------------------------------
# 1. 対象ファイルを列挙する
# ---------------------------------------------------------------------------
info "ファイルを列挙します..."
if [ "$ALL" -eq 1 ]; then
  find "$@" -type f -print > "$INVENTORY"
  n_nul=$(find "$@" -type f -print0 | tr -dc '\0' | wc -c)
else
  find "$@" -type f \( \
       -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o \
       -iname '*.gif' -o -iname '*.mp4'  -o -iname '*.jpe' \
     \) -print > "$INVENTORY"
  n_nul=$(find "$@" -type f \( \
       -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o \
       -iname '*.gif' -o -iname '*.mp4'  -o -iname '*.jpe' \
     \) -print0 | tr -dc '\0' | wc -c)
fi
n_inv=$(wc -l < "$INVENTORY")
if [ "$n_nul" -ne "$n_inv" ]; then
  warn "改行を含むファイル名が $((n_nul - n_inv)) 個あります。これらは対象外になります"
fi
info "対象 $n_inv 件"

# ---------------------------------------------------------------------------
# 2. まだ md5 を計算していないものだけ残す
# ---------------------------------------------------------------------------
if [ -s "$CATALOG" ]; then
  awk -F'\t' 'NR==FNR { seen[$2]=1; next } !($0 in seen)' "$CATALOG" "$INVENTORY" > "$TODO"
else
  cp "$INVENTORY" "$TODO"
fi
n_todo=$(wc -l < "$TODO")

bytes=0
if [ "$n_todo" -gt 0 ]; then
  bytes=$(tr '\n' '\0' < "$TODO" | xargs -0 -r stat -c '%s' 2>/dev/null | awk '{s+=$1} END{print s+0}')
fi
info "md5 未計算 $n_todo 件 / $(awk -v b="$bytes" 'BEGIN{printf "%.1f GiB", b/1073741824}')"

if [ "$DRYRUN" -eq 1 ]; then
  info "-n が指定されているのでここで終わります"
  exit 0
fi

# ---------------------------------------------------------------------------
# 3. md5 を計算して catalog に追記する（Ctrl-C で中断しても続きから再開できる）
# ---------------------------------------------------------------------------
if [ "$n_todo" -gt 0 ]; then
  info "md5 を計算します（並列 $JOBS）..."
  # md5sum の出力は "hash  path"。名前に \ が含まれると先頭に \ が付き
  # 中身がエスケープされるので、その行は捨てる。
  xargs -a "$TODO" -d '\n' -P "$JOBS" -n 16 "$MD5" \
    | awk '
        /^\\/ { next }
        { h = substr($0, 1, 32); p = substr($0, 35);
          if (h ~ /^[0-9a-f]{32}$/ && p != "") print h "\t" p; fflush();
          n++; if (n % 200 == 0) printf("  ... %d 件\r", n) > "/dev/stderr" }
        END { printf("  ... %d 件\n", n) > "/dev/stderr" }
      ' >> "$CATALOG"
fi

# ---------------------------------------------------------------------------
# 4. 突き合わせ
# ---------------------------------------------------------------------------
info "突き合わせます..."
awk -F'\t' -v want_file="$WANTED" '
  BEGIN {
    while ((getline line < want_file) > 0) {
      gsub(/[ \t\r]/, "", line)
      if (line == "" || line ~ /^#/) continue
      want[tolower(line)] = 1
    }
  }
  ($1 in want) {
    if (++cnt[$1] == 1) { print $1 "\t" $2 > "/dev/stdout" }
    else { print $1 "\t" $2 > "/dev/stderr" }
  }
' "$CATALOG" > "$OUT/matched.paths" 2> "$OUT/duplicates.tsv"

: > "$OUT/matched.tsv"
total=0
while IFS=$'\t' read -r md5 p; do
  sz=$(stat -c '%s' -- "$p" 2>/dev/null || echo 0)
  printf '%s\t%s\t%s\n' "$md5" "$sz" "$p" >> "$OUT/matched.tsv"
  total=$((total + sz))
  dst="$OUT/staging/$md5"
  if [ ! -e "$dst" ]; then
    ln -- "$p" "$dst" 2>/dev/null || cp -p -- "$p" "$dst"
  fi
done < "$OUT/matched.paths"
rm -f "$OUT/matched.paths"

awk -F'\t' '
  NR==FNR { found[$1]=1; next }
  { gsub(/[ \t\r]/, ""); if ($0 == "" || $0 ~ /^#/) next
    if (!(tolower($0) in found)) print tolower($0) }
' "$OUT/matched.tsv" "$WANTED" > "$OUT/missing.txt"

n_want=$(grep -cE '^[0-9a-fA-F]{32}$' "$WANTED" || true)
n_found=$(wc -l < "$OUT/matched.tsv")
n_miss=$(wc -l < "$OUT/missing.txt")
n_dup=$(wc -l < "$OUT/duplicates.tsv")

echo
info "見つかった: $n_found / $n_want"
info "見つからず: $n_miss  ($OUT/missing.txt)"
[ "$n_dup" -gt 0 ] && info "同じ md5 の別ファイル: $n_dup 件（$OUT/duplicates.tsv・実害なし）"
info "staging の合計: $(awk -v b="$total" 'BEGIN{printf "%.2f GiB", b/1073741824}')"
echo
if [ "$n_found" -gt 0 ]; then
  cat <<EOS
次はこれを VPS に送ってください:

  rsync -av --progress $OUT/staging/ <vps>:/tmp/gears-restore/

まだ見つかっていないものが残っているなら、別のディレクトリを足したり
-a を付けて拡張子の縛りを外して、同じコマンドをもう一度実行できます
（catalog.tsv があるので計算済みのファイルはやり直しません）。
EOS
fi
