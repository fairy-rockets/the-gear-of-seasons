#!/bin/bash
ROOT_DIR="$(cd "$(readlink -f "$(dirname "$0")")" && cd .. && pwd)"
cd "${ROOT_DIR}" || exit 1

export "OMOTE_HOST=hexe.net:8888"
export "URA_HOST=ura.hexe.net:8888"

set -eu
set -o pipefail
(cd lib && npm run watch) &
LIB="$!"
(cd client && npm run watch) &
CLI="$!"
(cd server && npm run watch) &
SRV="$!"

trap kill_all EXIT

function kill_all() {
  echo
  echo killing...
  kill 0 > /dev/null 2>&1
}
wait "${LIB}"
wait "${CLI}"
wait "${SRV}"
