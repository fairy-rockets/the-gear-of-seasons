# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This repository is the application itself: a personal photo/moment blog ("the gear of seasons", served at hexe.net) with a TypeScript Fastify server and a WebGL TypeScript client.

Production runs it from `7io-org/compose`, whose `the-gear-of-seasons/` directory pulls this repository in as a git submodule (`src/the-gear-of-seasons/`) and deploys it. Getting an application change into production therefore takes a second PR there that bumps the submodule pointer, after the change is merged here.

## Workflow & hosting

This repository lives on a self-managed **Forgejo** instance at `code.ledyba.org` (remote `ssh://git@code.ledyba.org:2222/fairy-rockets/the-gear-of-seasons.git`). How a change gets in (worktree → branch → PR → Approve → merge → cleanup) is the **`dev-workflow`** skill; the `fgj` CLI that stands in for GitHub's `gh` is the **`fgj`** skill. Read both before touching the tree.

The default branch is **`main`**.

## Commands

Server and client are separate npm packages, each built independently:

```sh
cd server && npm ci && npm run build    # tsc → dist/
cd server && npm test                   # mocha, spec files: src/**/*.spec.ts
cd server && npm run watch              # ts-node-dev live server

cd client && npm ci && npm run build    # webpack → dist/
cd client && npm run watch
```

To run only some server tests, filter by suite/test title: `cd server && npx mocha --grep FML` (mocharc already wires up ts-node/esm). Passing a spec file — positionally or with `--spec` — does not narrow the run: mocha appends it to the `spec` glob in `.mocharc.json`, so every spec file still runs.

Tests require **ffmpeg** and **ImageMagick 7+** (`magick` binary) on PATH — media probing/conversion shells out to them.

For local development against a database: `docker compose -f compose.dev.yml up -d postgres-dev` exposes postgres on 127.0.0.1:5432, then run the server with `DB_HOST=localhost`.

Production database migrations are applied by hand with Flyway; follow "How to migrate the database" in `README.md`, which runs against the production stack. For the local `postgres-dev`, `compose.dev.yml` also defines a `flyway` service (profile `tool`), and `db/flyway_data/conf/flyway.dev.conf` points at `postgres-dev`.

## Architecture

The server serves **two sites from one Fastify instance, distinguished by Host header** (`server/src/Config.ts`):

- **omote** (表, `OMOTE_HOST`, default `hexe.net`): the public site — WebGL front-end showing moments arranged on a seasonal gear.
- **ura** (裏, `URA_HOST`, default `ura.hexe.net`): the private admin/editor UI — upload, edit, preview, save, delete moments. There is no auth in the app; access control is expected to happen upstream (reverse proxy).

`server/src/Server.ts` defines all routes and dispatches via `omote`/`ura`/`both`/`each` helpers that 404 on the wrong hostname. This omote/ura split is mirrored everywhere: `server/src/controller/{omote,ura,both}/`, `client/src/{omote,ura}/`, `_assets/{static,templates}/{omote,ura}/`, and webpack entries `omote/main` + `ura/editor`.

Server layering (entry: `server/src/cmd/main.ts`, listens on port 3000):

- **Repo** (`repo/`): PostgreSQL access via ts-postgres with a connection pool and NodeCache. Two tables (`db/flyway_data/sql/V0__init.sql`, `V1__moment_status.sql`): `moments` (keyed by timestamp; title/author/text; `status` draft/published) and `entities` (media keyed by md5 hash; image/video/audio with medium/icon derivative ids).
- **Storage** (`storage/`): content-addressed file store under `_storage/` — three kinds (`original`, `medium`, `icon`), files sharded by md5 as `ab/cd/ef/rest-of-hash`.
- **Shelf** (`shelf/`): domain layer combining Repo + Storage; handles uploads (probes media, generates medium/icon derivatives via ffmpeg/ImageMagick) and moment CRUD.
- **fml** (`lib/fml.ts`): custom markup language for moment bodies (text/image/video/audio/markdown blocks), rendered to HTML by `renderer/MomentRenderer.ts`.
- **protocol** (`lib/protocol.ts`): shared server↔client types; the client imports it via symlink `client/src/protocol.ts`.

Maintenance commands in `server/src/cmd/`: `gc.ts` (remove orphaned storage files), `sanity-check.ts`, `regenerate-cache.ts`, `list-missing.ts` (list lost media; see `tools/README.md`) — run as `node server/dist/cmd/<name>.js` inside the production app container (from `7io-org/compose`'s `the-gear-of-seasons/`, `make gc` / `make sanity-check` wrap the first two).

`tools/` holds the tooling for finding and restoring lost media, described in `tools/README.md`. Among it, `tools/restore.rs/` is a standalone Rust utility for restoring/deduplicating media from backups; it is not part of the build.
