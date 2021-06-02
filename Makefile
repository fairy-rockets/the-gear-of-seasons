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

