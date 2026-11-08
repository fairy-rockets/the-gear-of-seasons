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
- `app-dev` gets `YOUTUBE_API_KEY` from the checkout's `.env` (not tracked); without it, importing YouTube videos fails and everything else works. A worktree needs its own copy of `.env`.
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
- **ura** (裏, `URA_HOST`, default `ura.hexe.net`): the private admin/editor UI — upload, edit, preview, save, delete moments, and enter the per-media annotations from the editor's preview (see "ura editor and saving" below). There is no auth in the app; access control is expected to happen upstream (reverse proxy).

`server/src/Server.ts` defines all routes and dispatches via `omote`/`ura`/`both`/`each` helpers that 404 on the wrong hostname. This omote/ura split is mirrored everywhere: `server/src/controller/{omote,ura,both}/`, `client/src/{omote,ura}/`, `_assets/{static,templates}/{omote,ura}/`, and webpack entries `omote/main` + `ura/editor` + `ura/moments`.

A moment's URL — the one users see and the one to link to — is `/<YYYY>/<MM>/<DD>/<HH:mm:ss>/` (e.g. `https://hexe.net/2016/11/25/05:58:19/`): omote shows it on the gear (`MomentController`), ura opens it in the editor. `/moment/<YYYY>/<MM>/<DD>/<HH:mm:ss>/` is not a page but the body fragment the gear fetches (`client/src/omote/World.ts`). Media is served from `/entity/<id>` (the original as uploaded; for a video kept outside the server, such as on YouTube, a 302 redirect to its page there), `/entity/<id>/medium` (images only) and `/entity/<id>/icon`; which of them each fml block displays or links to is described on its type in `server/src/lib/fml.ts`.

Server layering (entry: `server/src/cmd/main.ts`, listens on port 3000):

- **Repo** (`repo/`): PostgreSQL access via `pg` (node-postgres), with a `pg.Pool` of up to 10 connections and NodeCache. See "Database" below for tables and transaction boundaries.
- **Storage** (`storage/`): content-addressed file store under `_storage/` — three kinds (`original`, `medium`, `icon`), files sharded by md5 as `ab/cd/ef/rest-of-hash`.
- **Shelf** (`shelf/`): domain layer combining Repo + Storage; handles uploads (probes media, generates medium/icon derivatives via ffmpeg/ImageMagick), videos kept outside the server, such as on YouTube (see "External videos" below) and moment CRUD.
- **fml** (`lib/fml.ts`): custom markup language for moment bodies (text/image/video/audio/markdown blocks), rendered to HTML by `renderer/MomentRenderer.ts`.
- **protocol** (`lib/protocol.ts`): shared server↔client types; the client imports it via symlink `client/src/protocol.ts`.

### Database

`Repo.transaction` runs its callback's queries on one connection between `BEGIN` and `COMMIT`. Use the repo passed to the callback: queries made through the outer repo use other connections, outside the transaction.

The schema is defined by the Flyway migrations `db/flyway_data/sql/V*__*.sql`:

| Table | Contents |
| --- | --- |
| `moments` | Keyed by timestamp; title, author and body text; `status` (draft/published); curation fields `tier` and `series`; `intent` (the aim of the work, an interpretation or a look back; NULL means not entered), which only ura and the curation export/import handle and omote never shows. |
| `entities` | Media keyed by md5 hash; image/video/audio type and medium/icon derivative ids. `location` is `internal` (the original is in `_storage/original`) or `external` (kept outside the server, e.g. a video on YouTube; only videos can be external); it has no default, so every INSERT sets it. `mime_type` is the type of the original, so it is non-NULL exactly for internal entities. `external_ref` (jsonb) is non-NULL exactly for external entities and holds what that platform needs to point at it, at least `platform` (YouTube: `{"platform": "youtube", "id": "<11-character video ID>"}`); the app validates the rest per platform. For external videos `width`/`height` are the embed size, used only as the aspect ratio. |
| `entity_annotations` | One row per entity: alt, `looks_*`, role, `materials` (the materials used, a free `text[]`) and the other per-media curation fields. NULL means "not entered". |

### External videos

Long videos are kept outside the server (for now only on YouTube) and shown in moments as an embedded player. Such a video is an ordinary `video` entity with `location = 'external'` (every entity type in `server/src/shelf/Entity.ts` has `location`; `location === 'external'` narrows to `ExternalVideoEntity`, whose `externalRef` is the parsed `external_ref` column), so the body still uses `[video entity="…"]`, and the gear, OGP, the SAVE date fallback, annotations, the moment list counts and `export-curation` treat it like any other video.

- The id is the md5 (32 hex digits) of `<platform>:<id>` (`youtube:<video ID>`), so every form of URL for the same video gives the same entity. `external_ref` holds `{"platform": "youtube", "id": "<video ID>"}`. Neither the page URL (`/entity/<id>` redirects to `https://www.youtube.com/watch?v=<video ID>`) nor the embed URL is stored; both are built per platform from `externalRef` (`server/src/lib/ExternalVideoRef.ts`). `mime_type` is NULL: it is the type of the original, which an external entity does not have.
- The only stored file is the icon, made with `makeImageIcon` from the first of `snippet.thumbnails` `maxres` → `standard` → `high`. There is no original or medium.
- `Shelf.insertExternalVideo` makes the entity from one YouTube Data API v3 `videos.list` call (`part=snippet,contentDetails,player,liveStreamingDetails`, `maxHeight=720`): the timestamp (see "Capture timestamps"), `player.embedWidth`/`embedHeight` as width/height, and `contentDetails.duration` as duration. Videos that are missing or private (`items` is empty) or live or upcoming (`snippet.liveBroadcastContent` other than `none`) are rejected. If the entity already exists it is returned without asking YouTube. YouTube is asked only here and in `regenerate-cache`, never on SAVE or display.
- The API key comes from the environment variable `YOUTUBE_API_KEY`. Without it the server still starts; only `/embed` (for videos not yet imported) and `regenerate-cache` of external entities fail (the other entities are still regenerated).
- Matching an input URL is per platform (`server/src/lib/ExternalVideoURL.ts`; YouTube is the only one, with the URL → video ID extraction in `server/src/lib/youtube.ts`); `/embed` uses it to pick the platform. Reading `external_ref` from the database does not parse URLs: `Repo` dispatches on `platform` and validates the content per platform (`parseExternalVideoRef`; for YouTube, an 11-character video ID), and an unknown platform or invalid content fails to load with the entity id in the error. Fetching is per platform too (`ExternalVideoPlatform` in `server/src/shelf/ExternalVideo.ts`). Tests pass their own platforms to `Shelf` and use neither the network nor a key.
- `MomentRenderer` renders an external `[video]` as an `<iframe class="embed external <platform>">` (styled through `embed external`, whatever the platform; src and title per platform, for YouTube `youtube-nocookie.com/embed/<video ID>`) with the same `data-entity`/`data-type` as `<video>`, an inline `aspect-ratio` from width/height and the embed width as `max-width`, so Shorts show portrait.

### ura moment list

`/moments/` (`MomentListController`) embeds a summary of every moment, including drafts, as JSON in the page. `Shelf.findMomentListItems` provides the curation fields, the total number of `[image]`/`[video]`/`[audio]` entities, counts per media type, and counts of unentered or unverified entities using `annotationState`.

`client/src/ura/moments/` filters this data in the browser:

- The メディア buttons toggle independently. A moment must contain every selected type; the URL query represents this as, for example, `media=video,audio`.
- Search matches the title and body text (text blocks and `[link]` text), not the fml markup.
- Filters are kept in the URL query and localStorage. A URL query takes precedence, so links such as the sidebar's 確認待ち (`?annotation=unverified`) select their own filter.
- A page opened with a query writes localStorage only after its filter is changed there. Returning to `/moments/` therefore restores the previously chosen filter.

### ura editor and saving

The moment SAVE (`Shelf.updateMoment`) writes every moment column, including the curation fields and `intent`. `import-curation` uses this same save path. Annotations are saved separately from the moment.

`intent` is entered in 意図 below the body, a `<details>` that starts closed; its textarea can be resized vertically. An empty field is saved as NULL. `Moment.Save.Request` requires `intent` (`null` when empty), so a request from a page that does not send it fails instead of clearing the value.

The ⬆ button opens a submenu (built by `client/src/ura/editor/Uploader.ts`) with ファイル, which uploads files through `POST /upload` as dragging and dropping does, and a URL field. Enter in the URL field sends `POST /embed` with JSON `{url}`; the server makes the external video entity (see "External videos") and, like `/upload`, returns the fml to insert (`[video entity="…"]`) as text/plain. Unsupported URLs and failed fetches return `{statusCode, error, message}` (400, 502, or 503 without an API key), shown as a toast. The submenu closes on a click outside it, on Esc, when focus moves to an element outside it and the ⬆ button, and when the window loses focus (which is also how a click inside the preview's YouTube iframe closes it).

Each medium in the editor preview (`<img>`/`<video>`/`<audio>`, or the `<iframe>` of an external video, with `data-entity` and `data-type`) has a mark showing its `annotationState`: unentered, unverified or verified; audio uses entered because it has no `human_verified` field. The states, selectable values and fields available for each entity type are defined in `lib/protocol.ts`, shared with the client.

Clicking a mark or an image opens a drawer over the text column (`client/src/ura/editor/AnnotationDrawer.ts`). It reads annotations with `GET /annotations?ids=<id>,…` and saves one entity with `POST /annotation` (`Shelf.saveEntityAnnotation`). Under the `materials` field the drawer shows buttons for the common materials (`kMaterialSuggestions` in `lib/protocol.ts`) that add the value to the field or remove it; values not among them can be typed in. The drawer rereads the annotation each time it opens and saves every field. A value changed elsewhere (another tab or `import-curation`) while the drawer is open can therefore be overwritten when it saves.

The editor attaches `beforeunload` only while the moment or annotation has unsaved input, or a SAVE, annotation save or DELETE is in flight. The moment is compared with its initial or last successfully saved raw input values; annotations compare touched field values with the loaded or saved annotation. Initial inputs are clean; failed saves and input added during a save remain protected. Each save clears only its own saved values. DELETE confirms discarding unsaved input before deleting the moment at its saved timestamp, then redirects without another leave confirmation. The browser regression scenarios are in `tools/preview/editor-unsaved.mjs`.

### Capture timestamps

Images use ImageMagick to read EXIF `DateTimeDigitized` (`CreateDate`), falling back to `DateTimeOriginal`. These timestamps are interpreted as server-local time; EXIF offset and subsecond tags are not used. The Docker image includes `imagemagick-heic` and `libheif-libde265` for HEIC reading and conversion.

Videos use the existing ffprobe result: `com.apple.quicktime.creationdate`, `DateTimeOriginal`, then `date`, first from container tags and then from the video stream. The container's `creation_time`, then the video stream's `creation_time`, are fallbacks. Only complete `YYYY-MM-DDTHH:mm:ss` timestamps (also allowing a space instead of `T` and fractional seconds) are accepted. Explicit offsets and UTC are honored; timestamps without a zone use server-local time. Missing, invalid and zero epoch dates are ignored; filesystem timestamps are not used. Audio has no capture timestamp.

Videos kept on YouTube use `liveStreamingDetails.actualStartTime` (when a live stream started), falling back to `snippet.publishedAt`; for a live stream archive `publishedAt` is later than the start.

When SAVE has no date, it uses the first image or video in body order with a capture timestamp. If none has one, it uses the current time. An explicitly entered date takes precedence.

## Maintenance commands

Maintenance commands in `server/src/cmd/`: `gc.ts` (ask one by one whether to delete each entity that no moment, including drafts, refers to; for an external video it deletes only the icon; it does not look for storage files that no entity refers to), `sanity-check.ts` (checks only the icon of external videos), `regenerate-cache.ts` (re-probe originals and rebuild medium/icon for every entity, or only for the entity IDs given as arguments; for an external video it asks its platform (now only YouTube) again and replaces only the icon, width/height and duration, keeping the id and timestamp; an entity that fails (a missing original, or an external video that cannot be fetched again: no API key, or deleted or private on YouTube) is reported with its id and reason on stderr and the rest continue, then it prints the number of failures and exits with 1 if any failed; the running server keeps entities cached without expiry, so restart the app container afterwards; the medium/icon files it replaces stay in storage and show up in `list-missing`'s `orphan-*.txt`), `list-missing.ts` (list lost media; external videos have no original and are left out of the original lists; see `tools/README.md`) — run as `node server/dist/cmd/<name>.js` inside the production app container (from `7io-org/compose`'s `the-gear-of-seasons/`, `make gc` / `make sanity-check` wrap the first two).

### Curation export

`export-curation.ts` writes the export studio reads (#49) as a tar to stdout, and nothing else to stdout (messages go to stderr): for every published moment, `<YYYYMMDD-HHMMSS>/hexe.yaml` (the moment's metadata, curation fields, `intent` and, per `[image]`/`[video]`/`[audio]` entity, its type, size and annotation; the `[markdown]` URLs, split into `repo`/`ref`/`path` when they are `https://raw.githubusercontent.com/` URLs or `https://code.ledyba.org/` `/raw/branch/`, `/raw/tag/` or `/raw/commit/` URLs, without a query or `#`) and `<YYYYMMDD-HHMMSS>/hexe.fml` (the body as stored), plus a top-level `index.yaml` listing each moment's `moment` and `title`.

Times are written in JST whatever the server's time zone, and the same database gives the same bytes (fixed key order, sorted entries, fixed tar header times/owners/modes, no generation time, no network access).

Run it in production with `-T`, since a TTY would turn `\n` into `\r\n` and break the tar: `docker compose exec -T the-gear-of-seasons node server/dist/cmd/export-curation.js > export.tar`. The keys, value checks and `moment` format it shares with `import-curation.ts` live in `server/src/shelf/CurationFormat.ts`.

### Curation import

`import-curation.ts` loads studio's curation file (the moment- and entity-level fields of #2 and #80; format in #43) into the database. The database is the source of truth, so it is not part of the regular flow; it is for rewriting many values at once, and nothing else depends on it.

By default it only prints the plan (changes, conflicts, counts) and writes nothing; `--apply` writes it in one transaction. It writes moments through the ura SAVE path, so for each moment it writes, the plan also lists `icon_id` when recomputing it from the body changes it.

Values already in the database that differ from the file are reported as conflicts and left alone unless `--overwrite` is given; database values equal to the defaults (`tier = archive`, `series = []` and `human_verified = false`) count as not entered, so the file's value is written without a conflict.

Pass `-` to read the file from stdin, so it need not be copied into the container: `docker compose exec -T the-gear-of-seasons node server/dist/cmd/import-curation.js - [--apply] [--overwrite] < curation.yaml`.

It reads the current values without locking them, so a moment or annotation saved in ura while it runs can be overwritten: do not edit in ura during an import. For the same reason a plan printed without `--apply` is not guaranteed to match what a later `--apply` writes; check what was written in the `--apply` run's own output. Every SAVE also writes the curation fields as the editor shows them, so saving from a tab opened before the import puts back the `tier`, `series` and `intent` the import changed.

### Tools

`tools/` holds the tooling for finding and restoring lost media, described in `tools/README.md`, plus the screenshot tooling in `tools/preview/` (see "Screenshots" above) and `tools/sync-from-prod.sh` (see "Development environment" above). Among the former, `tools/restore.rs/` is a standalone Rust utility for restoring/deduplicating media from backups; it is not part of the build.
