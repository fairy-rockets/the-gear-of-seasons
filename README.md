# the gear of seasons (季節の歯車)

[Here is a running gear!](https://hexe.net/)

## Pre-requirements

- node.js 22 or higher
- ffmpeg
- ImageMagick 7.0 or higher

## How to build

The server and the client are separate npm packages, each built on its own:

```sh
(cd server && npm ci && npm run build)
(cd client && npm ci && npm run build)
```

## How to test

```sh
(cd server && npm test)
```

## How to migrate the database

The schema is managed by Flyway (`db/flyway_data/sql/V*__*.sql`).
The `flyway` service in `compose.yml` belongs to the `tool` profile, so `make up` (`docker compose up`) does not run it.
Run the steps below by hand, in the directory holding the `compose.yml` that runs the production stack.

1. Back up the database. The user and database name are the `postgres` service's own `POSTGRES_USER` / `POSTGRES_DB`, read inside the container:

   ```sh
   docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "backup-$(date +%Y%m%d-%H%M%S).sql"
   ```

2. Apply the migrations. `FLYWAY_CONFIG_FILES` selects `flyway.conf`, which points at the `postgres` service:

   ```sh
   docker compose run --rm -e FLYWAY_CONFIG_FILES=/flyway/conf/flyway.conf flyway migrate
   ```

3. Deploy the new application only after the migrations have been applied.
   The application reads the columns the migrations add, so starting it on an older schema breaks every page that reads moments.
