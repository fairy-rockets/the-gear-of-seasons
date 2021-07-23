#! /bin/bash -eu

BACKUP_FILENAME="backup-$(date '+%Y%m%d').tar"

PROJ_PATH="$(readlink -f "$(cd "$(dirname "$(readlink -f $0)")" && pwd)")"
cd "${PROJ_PATH}/.."

USR_GID="$1"
shift
USR_UID="$1"
shift

docker-compose down
tar -cvf "${BACKUP_FILENAME}" "$@"
chown "${USR_GID}:${USR_UID}" "${BACKUP_FILENAME}"
docker-compose up -d
