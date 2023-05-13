.PHONY: all
all: ps ;

.PHONY: up
up: var/ _storage/ _share
	docker-compose up -d

.PHONY: down
down:
	docker-compose down

.PHONY: reload
reload:
	$(MAKE) down
	$(MAKE) up

.PHONY: restart
restart: var/ _storage/
	docker-compose restart

.PHONY: build
build:
	docker pull node:18-alpine
	docker-compose build

.PHONY: pull
pull:
	docker-compose pull

.PHONY: log
log:
	docker-compose logs -f --tail 0

.PHONY: ps
ps:
	docker-compose ps

.PHONY: top
top:
	docker-compose top

.PHONY: chown
chown:
	sudo chown "$(shell id -g):$(shell id -u)" * -Rf

.PHONY: backup
backup:
	sudo bash _scripts/backup.sh $(shell id -g) $(shell id -u) var _storage

var/ _storage/ _share:
	mkdir -p "$@"

# -----------------------------------------------------------------------------
# DB
# -----------------------------------------------------------------------------

.PHONY: db-cli
db-cli:
	bash db/cli

.PHONY: migrate
db-migrate:
	bash db/flyway migrate

.PHONY: dump
db-dump:
	bash db/dump

.PHONY: gear-cli
gear-cli:
	docker-compose exec 'the-gear-of-seasons' bash

# -----------------------------------------------------------------------------
# batch
# -----------------------------------------------------------------------------

.PHONY: gear-cli
gear-gc:
	docker-compose run --rm \
		'the-gear-of-seasons' \
		'/app/server/dist/cmd/gc.js'

.PHONY: gear-cli
gear-regenerate:
	docker-compose run --rm \
		'the-gear-of-seasons' \
		'/app/server/dist/cmd/regenerate-cache.js'

.PHONY: gear-heapdump
gear-heapdump:
	docker-compose kill -s SIGUSR1 'the-gear-of-seasons'

# -----------------------------------------------------------------------------
# npm
# -----------------------------------------------------------------------------

.PHONY: upgrade
upgrade:
	cd client && npm run up
	cd server && npm run up
