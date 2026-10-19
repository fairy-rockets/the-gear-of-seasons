#!/bin/bash
# 本番の DB と storage を開発環境(compose.dev.yml)へ片方向に写す。`make sync-from-prod` から呼ぶ。
#
# 本番に対して行うのは pg_dump と rsync の読み出しだけで、本番のコンテナは止めない。
# 開発側の DB は毎回作り直すので、何度実行しても同じ状態になる。
#
# 環境変数:
#   PROD          本番に入る ssh のホスト名
#   PROD_DIR      本番の compose.yml があるディレクトリ
#   PROD_STORAGE  本番の storage
#   RSYNC_OPTS    rsync に足すオプション(例: --bwlimit=20000)
#   RSYNC_PATH    本番側で動かす rsync(既定は I/O の優先度を下げた `ionice -c3 rsync`)
set -euo pipefail

: "${PROD:?}" "${PROD_DIR:?}" "${PROD_STORAGE:?}"
RSYNC_OPTS=${RSYNC_OPTS:-}
RSYNC_PATH=${RSYNC_PATH:-ionice -c3 rsync}

cd "$(dirname "$0")/.."

DB=the-gear-of-seasons
DB_USER=the-gear-of-seasons
DEV_COMPOSE=(docker compose -f compose.dev.yml)

mkdir -p dev-var/psql dev-var/storage

# 1. DB の dump を取る。最後まで取れたことを確かめてから開発 DB を入れ替える。
dump="$(mktemp dev-var/prod-dump.XXXXXX.sql)"
trap 'rm -f "$dump"' EXIT

echo "dumping database from ${PROD} ..." >&2
ssh "$PROD" "cd '${PROD_DIR}' && docker compose exec -T postgres sh -c 'pg_dump -U \"\$POSTGRES_USER\" \"\$POSTGRES_DB\"'" > "$dump"
if ! grep -qF -- '-- PostgreSQL database dump complete' < <(tail -n 5 "$dump"); then
  echo "dump from ${PROD} is incomplete" >&2
  exit 1
fi

# 2. 開発 DB を作り直して流し込む。
"${DEV_COMPOSE[@]}" up -d postgres-dev
# 初回は initdb のあいだ unix socket だけの一時サーバーが立つので、TCP で待つ。
echo -n "waiting for postgres-dev ... " >&2
tries=0
until "${DEV_COMPOSE[@]}" exec -T postgres-dev pg_isready -q -h 127.0.0.1 -U "$DB_USER" 2>/dev/null; do
  tries=$((tries + 1))
  if [ "$tries" -ge 60 ]; then
    echo "failed" >&2
    echo "postgres-dev did not become ready in 60s. See: docker compose -f compose.dev.yml logs postgres-dev" >&2
    echo "If dev-var/psql was created by another PostgreSQL major version, remove it and run this again." >&2
    exit 1
  fi
  sleep 1
done
echo "ok" >&2

psql_dev() {
  "${DEV_COMPOSE[@]}" exec -T postgres-dev psql -q -v ON_ERROR_STOP=1 -U "$DB_USER" "$@"
}
psql_dev -d postgres -c "DROP DATABASE IF EXISTS \"${DB}\" WITH (FORCE)"
psql_dev -d postgres -c "CREATE DATABASE \"${DB}\" OWNER \"${DB_USER}\""
psql_dev -d "$DB" -1 < "$dump" > /dev/null

# 3. storage を写す。DB の後にすることで、DB が参照するファイルは必ず手元にある。
echo "syncing storage from ${PROD}:${PROD_STORAGE} ..." >&2
# shellcheck disable=SC2086
rsync -a --delete --rsync-path="$RSYNC_PATH" $RSYNC_OPTS "${PROD}:${PROD_STORAGE}/" dev-var/storage/

# 4. 動いている app-dev は古い接続とキャッシュを持っているので起こし直す。
if [ -n "$("${DEV_COMPOSE[@]}" ps -q --status running app-dev)" ]; then
  "${DEV_COMPOSE[@]}" restart app-dev
fi

echo "done" >&2
