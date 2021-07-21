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
## install
########################################################################################################################

.PHONY: install
install: install-lib install-client install-server ;

.PHONY: install-lib
install-lib: FORCE
	cd lib && npm install

.PHONY: install-server
install-server: FORCE
	cd server && npm install

.PHONY: install-client
install-client: FORCE
	cd client && npm install

########################################################################################################################
## upgrade deps
########################################################################################################################

.PHONY: deps
deps:
	cd lib && npm run up
	cd client && npm run up
	cd server && npm run up

########################################################################################################################
## db
########################################################################################################################

.PHONY: up
up: ./var/postgres
	USER_ID=$(shell id -u) GROUP_ID=$(shell id -g) docker-compose up -d
	$(MAKE) wait

.PHONY: down
down: FORCE
	USER_ID=$(shell id -u) GROUP_ID=$(shell id -g) docker-compose down

.PHONY: wait
wait: FORCE
	@USER_ID=$(shell id -u) GROUP_ID=$(shell id -g) docker-compose run \
		--rm \
		--use-aliases \
		postgres \
		bash /helpers/wait-boot.sh

.PHONY: migrate
migrate: FORCE
	bash db/flyway migrate

.PHONY: clean
clean: FORCE
	rm -Rfv var/* lib/dist server/dist client/dist

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

########################################################################################################################
## fun
########################################################################################################################

.PHONY: cl
cl:
	@bash _helpers/cl.sh lib/src
	@bash _helpers/cl.sh client/src
	@bash _helpers/cl.sh server/src
