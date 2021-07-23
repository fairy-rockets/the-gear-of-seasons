.PHONY: all
all: ps ;

.PHONY: up
up:
	docker-compose up -d

.PHONY: down
down:
	docker-compose down

.PHONY: reload
reload:
	$(MAKE) down
	$(MAKE) up

.PHONY: restart
restart:
	docker-compose restart

.PHONY: build
build:
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
	sudo bash _helpers/backup.sh $(shell id -g) $(shell id -u) var conf

# -----------------------------------------------------------------------------

.PHONY: db-cli
db-cli:
	docker-compose run \
  		--rm \
  		--user "$(shell id -u)" \
		--use-aliases \
		  -e 'PGPASSWORD=synapse' \
		  postgres \
			  psql  '--username=synapse' \
        			'--host=postgres' \
        			synapse

.PHONY: generate-config
generate-config:
	docker-compose run --rm synapse generate

.PHONY: register
register:
	docker-compose exec synapse \
	  register_new_matrix_user \
			-c /config/homeserver.yaml \
			http://localhost:8008

