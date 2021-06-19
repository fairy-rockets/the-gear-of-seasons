########################################################################################################################
## dev
########################################################################################################################

.PHONY: dev
dev:
	bash _helpers/dev.sh

.PHONY: test
test:
	cd lib && npm run test

########################################################################################################################
## prepare
########################################################################################################################

.PHONY: prepare
prepare: prepare-lib prepare-client prepare-server ;

.PHONY: prepare-lib
prepare-lib:
	cd lib && npm install

.PHONY: prepare-server
prepare-server:
	cd server && npm install

.PHONY: prepare-client
prepare-client:
	cd client && npm install

########################################################################################################################
## db
########################################################################################################################

.PHONY: up
up: ./var/postgres
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

########################################################################################################################
## build
########################################################################################################################

.PHONY: FORCE
FORCE: ;

.PHONY: build
build:
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
