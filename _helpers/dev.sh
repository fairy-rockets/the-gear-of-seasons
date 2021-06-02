#!/bin/bash
ROOT_DIR="$(cd "$(readlink -f "$(dirname "$0")")" && cd .. && pwd)"
cd "${ROOT_DIR}" || exit 1

set -eu
set -o pipefail
(cd bridge && npm run watch) &
BRG="$!"
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
wait "${BRG}"
wait "${CLI}"
wait "${SRV}"
