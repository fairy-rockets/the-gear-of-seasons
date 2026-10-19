#!/bin/bash
# プレビューを指定サイズで一枚撮る。
#
#   ./shot.sh <URL> <出力先.png> [幅x高さ]
#
# 例:
#   ./shot.sh http://localhost:8889/ out/portrait.png 390x844   # iPhone 相当
#   ./shot.sh http://localhost:8889/ out/desktop.png 1280x800
#
# URL のホスト名は、プレビューコンテナの OMOTE_HOST と一致していないと 404 になる
# (Fastify の req.hostname はポートを含まないので、OMOTE_HOST=localhost なら
# localhost:8889 で通る)。詳しくは README.md。
set -euo pipefail

URL=${1:?usage: shot.sh <URL> <out.png> [WxH]}
OUT=${2:?usage: shot.sh <URL> <out.png> [WxH]}
SIZE=${3:-390x844}
WIDTH=${SIZE%x*}
HEIGHT=${SIZE#*x}

HERE="$(cd "$(dirname "$0")" && pwd)"
IMAGE=gears-shot

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "building $IMAGE ..." >&2
  docker build -q -t "$IMAGE" "$HERE" >/dev/null
fi

OUTDIR="$(cd "$(dirname "$OUT")" && pwd)"
OUTNAME="$(basename "$OUT")"

# --network host はホストに publish されたプレビューのポートへ届かせるため。
# --virtual-time-budget はテクスチャ(最大 300 枚)の読み込みを待つぶん長めにとる。
docker run --rm --network host -v "${OUTDIR}:/out" "$IMAGE" \
  chromium --headless --no-sandbox --disable-dev-shm-usage \
    --enable-unsafe-swiftshader --hide-scrollbars \
    --window-size="${WIDTH},${HEIGHT}" \
    --virtual-time-budget=25000 \
    --screenshot="/out/${OUTNAME}" \
    "$URL" >/dev/null 2>&1

echo "${OUT} (${WIDTH}x${HEIGHT})"
