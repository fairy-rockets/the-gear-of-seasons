# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This repository is the application itself: a personal photo/moment blog ("the gear of seasons", served at hexe.net) with a TypeScript Fastify server and a WebGL TypeScript client.

Production runs it from `7io-org/compose`, whose `the-gear-of-seasons/` directory pulls this repository in as a git submodule (`src/the-gear-of-seasons/`) and deploys it. Getting an application change into production therefore takes a second PR there that bumps the submodule pointer, after the change is merged here.

## Workflow & hosting

This repository lives on a self-managed **Forgejo** instance at `code.ledyba.org` (remote `ssh://git@code.ledyba.org:2222/fairy-rockets/the-gear-of-seasons.git`). How a change gets in (worktree → branch → PR → Approve → merge → cleanup) is the **`dev-workflow`** skill; the `fgj` CLI that stands in for GitHub's `gh` is the **`fgj`** skill. Read both before touching the tree.

The default branch is **`main`**.

## Commands

Server and client are separate npm packages, each built independently (on the development machine, run these inside `make dev-shell`; see "Development environment" below — `app-dev` itself already serves on port 3000 there, so `npm run watch` in `server` collides with it):

```sh
cd server && npm ci && npm run build    # tsc → dist/
cd server && npm test                   # mocha, spec files: src/**/*.spec.ts
cd server && npm run watch              # ts-node-dev live server

cd client && npm ci && npm run build    # webpack → dist/
cd client && npm run watch
```

To run one spec file, pass it to mocha directly: `cd server && npx mocha src/repo/Repo.spec.ts` (`.mocharc.json` wires up ts-node/esm; the `src/**/*.spec.ts` glob lives only in the `test` script). To filter by suite/test title instead: `cd server && npm test -- --grep FML`. `npm test -- <file>` does not narrow the run — the file is appended to the glob, so every spec still runs.

Tests require **ffmpeg** and **ImageMagick 7+** (`magick` binary) on PATH — media probing/conversion shells out to them.

Production database migrations are applied by hand with Flyway; follow "How to migrate the database" in `README.md`, which runs against the production stack. For the development `postgres-dev`, `compose.dev.yml` also defines a `flyway` service (profile `tool`), and `db/flyway_data/conf/flyway.dev.conf` points at `postgres-dev`.

## Development environment

Development happens on the development machine **rinn**, not on production. Build, test and run all happen inside containers from `compose.dev.yml`, so the host needs only Docker, `make`, `ssh` and `rsync` — no node, ffmpeg or ImageMagick. The `app-dev` container is the `tools` stage of the `Dockerfile` (the same node / ffmpeg / ImageMagick 7 as production) with this checkout bind-mounted at `/app`; it runs as the host user, so `node_modules/` and `dist/` in the checkout belong to you.

```sh
make sync-from-prod   # copy production's database and storage into dev-var/ (one way)
make dev-up           # postgres-dev + app-dev: npm ci + build client/server, then serve on 127.0.0.1:8889
make dev-log          # follow the logs
make dev-shell        # bash inside app-dev
make dev-test         # cd server && npm test, inside a fresh app-dev container (npm ci first if package-lock.json is newer)
make dev-down
```

- One development environment per machine: container names and the host ports (`127.0.0.1:5432`, `127.0.0.1:8889`) are fixed, so stop the main checkout's environment (`make dev-down`) before bringing one up in a worktree. `dev-var/` belongs to each checkout, so a fresh worktree needs its own first sync.
- omote is `http://localhost:8889/`, ura is `http://ura.localhost:8889/` (`OMOTE_HOST=localhost`, `URA_HOST=ura.localhost`). From another machine, forward the port first: `ssh -L 8889:127.0.0.1:8889 rinn`.
- `app-dev` builds once at startup; after changing code, `docker compose -f compose.dev.yml restart app-dev` (or rebuild inside `make dev-shell`, then restart).
- `make sync-from-prod` (`tools/sync-from-prod.sh`) reads production over `ssh $(PROD)` (default `nodoca`): it takes a `pg_dump` from the production postgres, and only once the dump is complete drops and recreates the development database from it; then it `rsync -a --delete`s the production storage into `dev-var/storage/`. Against production it only reads — nothing is stopped or written there. Running it again gives the same state.
- **Every sync overwrites the development database.** `postgres-dev` then holds production's data, including drafts, and production's migration version (`flyway_schema_history` comes with the dump); migrations or data you added in development are gone.
- The first sync copies the whole storage (about 12G) and takes a while; later runs only transfer the difference. On production rsync runs under `ionice -c3`; to lower the load further, `make sync-from-prod RSYNC_OPTS=--bwlimit=20000`.

## Screenshots

**omote is WebGL — unit tests show you nothing about it. If you change how it looks, take a screenshot.** `tools/preview/` holds the tooling and the traps (`tools/preview/README.md`): `shot.sh` grabs one frame at a given viewport size, `drive.mjs` is a puppeteer template for scenarios that need interaction (device rotation, dragging the gear) without a reload. Both run Chromium in a **Debian** container — alpine's chromium cannot get a WebGL context, and silently produces a screenshot with no gear in it.

Take them on the development machine against the development environment (see "Development environment" above): `make dev-up`, then `tools/preview/shot.sh http://localhost:8889/ out/portrait.png 390x844` (`out/` is gitignored).

## Architecture

The server serves **two sites from one Fastify instance, distinguished by Host header** (`server/src/Config.ts`):

- **omote** (表, `OMOTE_HOST`, default `hexe.net`): the public site — WebGL front-end showing moments arranged on a seasonal gear.
- **ura** (裏, `URA_HOST`, default `ura.hexe.net`): the private admin/editor UI — upload, edit, preview, save, delete moments. There is no auth in the app; access control is expected to happen upstream (reverse proxy).

`server/src/Server.ts` defines all routes and dispatches via `omote`/`ura`/`both`/`each` helpers that 404 on the wrong hostname. This omote/ura split is mirrored everywhere: `server/src/controller/{omote,ura,both}/`, `client/src/{omote,ura}/`, `_assets/{static,templates}/{omote,ura}/`, and webpack entries `omote/main` + `ura/editor`.

A moment's URL — the one users see and the one to link to — is `/<YYYY>/<MM>/<DD>/<HH:mm:ss>/` (e.g. `https://hexe.net/2016/11/25/05:58:19/`): omote shows it on the gear (`MomentController`), ura opens it in the editor. `/moment/<YYYY>/<MM>/<DD>/<HH:mm:ss>/` is not a page but the body fragment the gear fetches (`client/src/omote/World.ts`). Media is served from `/entity/<id>` (the original as uploaded), `/entity/<id>/medium` (images only) and `/entity/<id>/icon`; which of them each fml block displays or links to is described on its type in `server/src/lib/fml.ts`.

Server layering (entry: `server/src/cmd/main.ts`, listens on port 3000):

- **Repo** (`repo/`): PostgreSQL access via ts-postgres with a connection pool and NodeCache; `Repo.transaction` runs its callback's queries on one connection between `BEGIN` and `COMMIT`. Three tables (`db/flyway_data/sql/V0__init.sql`, `V1__moment_status.sql`, `V2__curation.sql`): `moments` (keyed by timestamp; title/author/text; `status` draft/published; curation `tier`/`series`/`sensitive`/`sensitive_manual`), `entities` (media keyed by md5 hash; image/video/audio with medium/icon derivative ids) and `entity_annotations` (one row per entity: alt, `looks_*`, role and the other per-media curation fields; NULL means "not entered"). The ura SAVE leaves `tier`/`series`/`sensitive_manual` alone; they are written only by the curation methods. While `sensitive_manual` is false, `sensitive` is recomputed from the body and the annotations (`shelf/Sensitive.ts`) whenever the moment or one of its annotations is saved. `text[]` columns are read through `array_to_json`: when ts-postgres 2.0.4 reads an empty array (`'{}'`) directly, the query fails and the connection is left broken but still handed out by the pool, so every later query on it fails ([malthe/ts-postgres#129](https://github.com/malthe/ts-postgres/issues/129)). Text columns where `''` must stay distinct from NULL (the `entity_annotations` strings) are read through `to_json`, because ts-postgres 2.0.4 reads every zero-length value as NULL (#48).
- **Storage** (`storage/`): content-addressed file store under `_storage/` — three kinds (`original`, `medium`, `icon`), files sharded by md5 as `ab/cd/ef/rest-of-hash`.
- **Shelf** (`shelf/`): domain layer combining Repo + Storage; handles uploads (probes media, generates medium/icon derivatives via ffmpeg/ImageMagick) and moment CRUD.
- **fml** (`lib/fml.ts`): custom markup language for moment bodies (text/image/video/audio/markdown blocks), rendered to HTML by `renderer/MomentRenderer.ts`.
- **protocol** (`lib/protocol.ts`): shared server↔client types; the client imports it via symlink `client/src/protocol.ts`.

Maintenance commands in `server/src/cmd/`: `gc.ts` (remove orphaned storage files), `sanity-check.ts`, `regenerate-cache.ts`, `list-missing.ts` (list lost media; see `tools/README.md`) — run as `node server/dist/cmd/<name>.js` inside the production app container (from `7io-org/compose`'s `the-gear-of-seasons/`, `make gc` / `make sanity-check` wrap the first two).

`export-curation.ts` writes the export studio reads (#49) as a tar to stdout, and nothing else to stdout (messages go to stderr): for every published moment, `<YYYYMMDD-HHMMSS>/hexe.yaml` (the moment's metadata, curation fields and, per `[image]`/`[video]`/`[audio]` entity, its type, size and annotation; the `[markdown]` URLs, split into `repo`/`ref`/`path` when they are GitHub or code.ledyba.org raw URLs) and `<YYYYMMDD-HHMMSS>/hexe.fml` (the body as stored), plus a top-level `index.yaml` listing each moment's `moment` and `title`. Times are written in JST whatever the server's time zone, and the same database gives the same bytes (fixed key order, sorted entries, fixed tar header times/owners/modes, no generation time, no network access). Run it in production with `-T`, since a TTY would turn `\n` into `\r\n` and break the tar: `docker compose exec -T the-gear-of-seasons node server/dist/cmd/export-curation.js > export.tar`. The keys, value checks and `moment` format it shares with `import-curation.ts` live in `server/src/shelf/CurationFormat.ts`.

`import-curation.ts` loads studio's curation file (the moment- and entity-level fields of #2; format in #43) into the database. The database is the source of truth, so it is not part of the regular flow; it is for rewriting many values at once, and nothing else depends on it. By default it only prints the plan (changes, conflicts, counts) and writes nothing; `--apply` writes it in one transaction. Values already in the database that differ from the file are reported as conflicts and left alone unless `--overwrite` is given; database values equal to the defaults (`tier = archive`, `series = []`, `checked = false`, and `sensitive` while `sensitive_manual = false`) count as not entered, so the file's value is written without a conflict. Pass `-` to read the file from stdin, so it need not be copied into the container: `docker compose exec -T the-gear-of-seasons node server/dist/cmd/import-curation.js - [--apply] [--overwrite] < curation.yaml`. It reads the current values without locking them, so a moment or annotation saved in ura while it runs can be overwritten: do not edit in ura during an import. For the same reason a plan printed without `--apply` is not guaranteed to match what a later `--apply` writes; check what was written in the `--apply` run's own output.

`tools/` holds the tooling for finding and restoring lost media, described in `tools/README.md`, plus the screenshot tooling in `tools/preview/` (see "Screenshots" above) and `tools/sync-from-prod.sh` (see "Development environment" above). Among the former, `tools/restore.rs/` is a standalone Rust utility for restoring/deduplicating media from backups; it is not part of the build.
