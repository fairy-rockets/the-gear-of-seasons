# the gear of seasons (季節の歯車)

[Here is a running gear!](https://hexe.net/?utm_source=github&utm_medium=social&utm_campaign=README.md)

## Image descriptions

Images in omote and the ura preview use the entity annotation's `alt` text when it is nonblank, whether or not `human_verified` is true. Other images use `an image.`. Empty or whitespace-only descriptions do not mark an image as decorative. Video and audio annotations are not rendered as labels. The same alt text goes into `og:image:alt` and `twitter:image:alt` for a page's OGP image (the moment's icon, or the site image on the fixed pages); when the image has none, or the icon is a video or audio thumbnail, those use the title of the moment the image comes from instead (on the fixed pages, 「太陽と帽子とお月さま」, not the page's own title).

## Pre-requirements

- node.js 26 or higher
- ffmpeg
- ImageMagick 7.0 or higher

Or use the development environment in `compose.dev.yml`, which provides all of them in a container; see "Development environment" in `CLAUDE.md`.

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

Production's `flyway` service reads the migrations from the checkout of this repository that `7io-org/compose` pulls in as a submodule (`src/the-gear-of-seasons/db/flyway_data/sql`).
So first merge the `7io-org/compose` PR that moves the submodule to a commit containing the new migration, and update the submodule in production; until then, `flyway migrate` finds nothing new to apply.
Do not restart the application yet (see step 3).

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
   A migration that drops a column the running application still reads is the exception: deploy the application that no longer reads it first, then apply the migration.
