#!/bin/bash

set -eu
set -o pipefail

echo -n '[Waiting Postgres] '
export 'PGPASSWORD=the-gear-of-seasons'
while ! psql '--username=the-gear-of-seasons' '--host=postgres' -c 'SELECT NOW();' > /dev/null  2>&1; do
  echo -n '.'
  sleep 1
done
echo 'OK'
