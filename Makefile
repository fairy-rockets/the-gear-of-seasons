########################################################################################################################
## dev
########################################################################################################################

.PHONY: dev
dev:
	bash _helpers/dev.sh

.PHONY: test
test:
	cd bridge && npm run test

########################################################################################################################
## db
########################################################################################################################

.PHONY: up
up: var/psql
	UID=$(shell id -u) GID=$(shell id -g) docker-compose up -d
	$(MAKE) wait

.PHONY: down
down:
	UID=$(shell id -u) GID=$(shell id -g) docker-compose down

.PHONY: wait
wait:
	@UID=$(shell id -u) GID=$(shell id -g) docker-compose run \
		--rm \
		--use-aliases \
		db \
		bash /helpers/wait-boot.sh

.PHONY: migrate
migrate:
	bash db/flyway migrate

.PHONY: clean
clean:
	rm -Rfv var/*

.PNONY: recreate
recreate:
	$(MAKE) down
	$(MAKE) clean
	$(MAKE) up
	$(MAKE) migrate

.PHONY: restart
restart:
	$(MAKE) down
	$(MAKE) up

.PHONY: cli
cli:
	bash ./db/cli-dev

var/psql:
	mkdir -p "$@"

########################################################################################################################
## build
########################################################################################################################

.PHONY: FORCE
FORCE: ;

.PHONY: build
build:
	$(MAKE) build-bridge
	$(MAKE) -j2 build-client build-server

.PHONY: build-bridge
build-bridge: FORCE
	cd bridge && npm run build

.PHONY: build-client
build-client: FORCE
	cd client && npm run build

.PHONY: build-server
build-server: FORCE
	cd server && npm run build

