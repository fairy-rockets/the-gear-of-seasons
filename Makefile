.PHONY: all
all: ps ;

.PHONY: up
up: var/ _storage/
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
	$(MAKE) down
	sudo bash _helpers/backup.sh $(shell id -g) $(shell id -u) var _storage
	$(MAKE) up

var/ _storage/:
	mkdir -p "$@"

# -----------------------------------------------------------------------------

.PHONY: db-cli
db-cli:
	bash db/cli

.PHONY: cli
cli:
	docker-compose exec "the-gear-of-seasons" bash

.PHONY: migrate
migrate:
	bash db/flyway migrate

.PHONY: dump
dump:
	bash db/dump

# -----------------------------------------------------------------------------

.PHONY: upgrade
upgrade:
	cd client && npm run up
	cd server && npm run up
