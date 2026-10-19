.PHONY: all
all: ps ;

.PHONY: FORCE
FORCE: ;

########################################################################################################################
## params
########################################################################################################################
# common
VAR_DIR=./var
VARS = $(VAR_DIR) $(VAR_DIR)/psql $(VAR_DIR)/storage

# postgres
PSQL_USER=the-gear-of-seasons
PSQL_PASS=the-gear-of-seasons
PSQL_NAME=the-gear-of-seasons

########################################################################################################################
## build
########################################################################################################################

.PHONY: upgrade
upgrade: FORCE
	cd server && npm run up
	cd client && npm run up

########################################################################################################################
## service
########################################################################################################################

.PHONY: up
up: $(VARS)
	docker compose up -d

.PHONY: down
down:
	docker compose down

.PHONY: reload
reload:
	$(MAKE) down
	$(MAKE) up

.PHONY: restart
restart:
	docker compose restart

.PHONY: build
build:
	docker compose build

.PHONY: pull
pull:
	docker compose pull

.PHONY: log
log:
	docker compose logs -f --tail 0

.PHONY: log-all
log-all:
	docker compose logs --tail all

.PHONY: ps
ps:
	docker compose ps

.PHONY: top
top:
	docker compose top

########################################################################################################################
## db
########################################################################################################################
# https://www.postgresql.jp/document/7.3/programmer/libpq-connect.html

.PHONY: db-up
db-up: $(VARS)
	docker compose up -d postgres
	@echo -n "Waiting boot... "
	@docker compose exec postgres "sh" "-c" "while ! pg_isready -U code > /dev/null; do echo -n '.'; sleep 1; done"
	@echo "[OK]"

.PHONY: db-down
db-down:
	docker compose down postgres

.PHONY: db-cli
db-cli:
	docker compose exec postgres psql "user=$(PSQL_USER) password=$(PSQL_PASS) dbname=$(PSQL_NAME)"

.PHONY: db-dump
db-dump:
	docker compose exec postgres pg_dump "user=$(PSQL_USER) password=$(PSQL_PASS) dbname=$(PSQL_NAME)"

.PHONY: db-read
db-read: db-up
	docker compose exec -T postgres psql "user=$(PSQL_USER) password=$(PSQL_PASS) dbname=$(PSQL_NAME)"

.PHONY: db-vacuum
db-vacuum:
	echo "VACUUM ANALYZE;" | docker compose exec -T postgres psql "user=$(PSQL_USER) password=$(PSQL_PASS)"

.PHONY: db-log
db-log:
	docker compose logs postgres -f --tail 0

## backup / restore

.PHONY: db-backup
db-backup:
	$(MAKE) db-dump > dump.sql

.PHONY: db-restore
db-restore:
	$(MAKE) db-read < dump.sql

.PHONY: db-ip
db-ip:
	@docker compose exec -T postgres /bin/hostname -i

########################################################################################################################
## development (compose.dev.yml)
########################################################################################################################
# app-dev はリポジトリをバインドするので、node_modules や dist をホストのユーザーで作らせる。
# (bash では UID が読み取り専用なので、env 越しに渡す)
DEV_UID ?= $(shell id -u)
DEV_GID ?= $(shell id -g)
DEV_COMPOSE = env UID=$(DEV_UID) GID=$(DEV_GID) docker compose -f compose.dev.yml
DEV_VARS = dev-var dev-var/psql dev-var/storage

# 本番
PROD ?= nodoca
PROD_DIR ?= /opt/books/the-gear-of-seasons
PROD_STORAGE ?= /opt/books/@var/the-gear-of-seasons/storage
RSYNC_OPTS ?=

.PHONY: dev-up
dev-up: $(DEV_VARS)
	$(DEV_COMPOSE) up -d --build

.PHONY: dev-down
dev-down:
	$(DEV_COMPOSE) down

.PHONY: dev-log
dev-log:
	$(DEV_COMPOSE) logs -f --tail 100

.PHONY: dev-shell
dev-shell:
	$(DEV_COMPOSE) exec app-dev bash

# node_modules は起動中の app-dev と共有しているので、npm ci は lockfile の方が新しいときだけにする
# (そのときは動いているサーバーの依存も入れ替わるので、app-dev を restart する)。
.PHONY: dev-test
dev-test: $(DEV_VARS)
	$(DEV_COMPOSE) run --rm --no-deps app-dev sh -c 'cd server && { { [ -f node_modules/.package-lock.json ] && [ ! package-lock.json -nt node_modules/.package-lock.json ]; } || npm ci; } && npm test'

.PHONY: sync-from-prod
sync-from-prod: $(DEV_VARS)
	PROD='$(PROD)' PROD_DIR='$(PROD_DIR)' PROD_STORAGE='$(PROD_STORAGE)' RSYNC_OPTS='$(RSYNC_OPTS)' \
		./tools/sync-from-prod.sh

$(DEV_VARS):
	mkdir -p "$@"

########################################################################################################################
## vars
########################################################################################################################

$(VARS):
	mkdir -p "$@"
