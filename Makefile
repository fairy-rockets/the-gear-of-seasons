.PHONY: all
all: dev ;

.PHONY: FORCE
FORCE: ;

########################################################################################################################
## dev
########################################################################################################################

.PHONY: dev
dev: FORCE
	bash _helpers/dev.sh

.PHONY: test
test: FORCE
	cd lib && npm run test

########################################################################################################################
## prepare
########################################################################################################################

.PHONY: prepare
prepare: prepare-lib prepare-client prepare-server ;

.PHONY: prepare-lib
prepare-lib: FORCE
	cd lib && npm install

.PHONY: prepare-server
prepare-server: FORCE
	cd server && npm install

.PHONY: prepare-client
prepare-client: FORCE
	cd client && npm install

########################################################################################################################
## db
########################################################################################################################

.PHONY: up
up: ./var/postgres
	UID=$(shell id -u) GID=$(shell id -g) docker-compose up -d
	$(MAKE) wait

.PHONY: down
down: FORCE
	UID=$(shell id -u) GID=$(shell id -g) docker-compose down

.PHONY: wait
wait: FORCE
	@UID=$(shell id -u) GID=$(shell id -g) docker-compose run \
		--rm \
		--use-aliases \
		postgres \
		bash /helpers/wait-boot.sh

.PHONY: migrate
migrate: FORCE
	bash db/flyway migrate

.PHONY: clean
clean: FORCE
	rm -Rfv var/*

.PNONY: recreate
recreate: FORCE
	$(MAKE) down
	$(MAKE) clean
	$(MAKE) up
	$(MAKE) migrate

.PHONY: restart
restart: FORCE
	$(MAKE) down
	$(MAKE) up

.PHONY: cli
cli: FORCE
	bash ./db/cli-dev

########################################################################################################################
## build
########################################################################################################################

.PHONY: build
build: FORCE
	$(MAKE) build-lib
	$(MAKE) -j2 build-client build-server

.PHONY: build-lib
build-lib: FORCE
	cd lib && npm run build

.PHONY: build-client
build-client: FORCE
	cd client && npm run build

.PHONY: build-server
build-server: FORCE
	cd server && npm run build

########################################################################################################################
## files
########################################################################################################################

# https://makefiletutorial.com/#automatic-variables
./var/postgres:
	mkdir -p "$@"
