########################################################################################################################
## build
########################################################################################################################

.PHONY: dev
dev:
	bash _helpers/dev.sh

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

########################################################################################################################
## DB
########################################################################################################################

.PHONY: up
up: var/psql
	UID=$(shell id -u) GID=$(shell id -g) docker-compose -f docker-compose.dev.yml up -d
	$(MAKE) wait

.PHONY: wait
wait:
	@UID=$(shell id -u) GID=$(shell id -g) docker-compose -f docker-compose.dev.yml run \
		--rm \
		--use-aliases \
		db \
		bash /helpers/wait-boot.sh

.PHONY: migrate
migrate:
	bash db/flyway-dev migrate

.PHONY: down
down:
	UID=$(shell id -u) GID=$(shell id -g) docker-compose -f docker-compose.dev.yml down

.PHONY: clean
clean:
	rm -Rfv var

.PNONY: reload
reload:
	$(MAKE) down
	$(MAKE) up

.PNONY: recreate
recreate:
	$(MAKE) down
	$(MAKE) clean
	$(MAKE) up
	$(MAKE) migrate

.PHONY: cli
cli:
	bash ./db/cli-dev

var/psql:
	mkdir -p "$@"
