.PHONY: all
all: dev;

.PHONY: FORCE
FORCE: ;

########################################################################################################################
## params
########################################################################################################################
# common
VAR_DIR=./var
VARS = $(VAR_DIR) $(VAR_DIR)/psql $(VAR_DIR)/storage $(VAR_DIR)/share

# postgres
PSQL_USER=the-gear-of-seasons
PSQL_PASS=the-gear-of-seasons
PSQL_NAME=the-gear-of-seasons

########################################################################################################################
## build
########################################################################################################################

.PHONY: dev
dev:
	bash _scripts/dev.sh

.PHONY: upgrade
upgrade: FORCE
	cd server && npm run up
	cd client && npm run up

########################################################################################################################
## service
########################################################################################################################

.PHONY: all
all: ps ;

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
## flyway
########################################################################################################################

.PHONY: migrate
migrate:
	docker compose --profile tool \
	  run --rm \
    -e 'FLYWAY_CONFIG_FILES=/flyway/conf/flyway.conf' \
    flyway "migrate"

########################################################################################################################
## vars
########################################################################################################################

$(VARS):
	mkdir -p "$@"
