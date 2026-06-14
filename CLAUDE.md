# CLAUDE.md

Guidance for AI agents working in this repo.

## What this is

A Node/Express server (TypeScript) that hosts **TRMNL private plugins** using the
**polling** strategy. Each plugin is mounted at `/plugins/<name>` and returns JSON
that TRMNL renders with a Liquid template configured in the TRMNL dashboard. The
server is built to host multiple plugins over time, distinguished by URL path.

First (and currently only) plugin: **tram** — upcoming PTV tram departures for a
given stop (required `:stopId` path param), route type 1.

## Runtime model — important

- **TypeScript runs with no build step.** Node 24 strips types at runtime, so the
  entrypoint is `node src/index.ts` directly. There is no `dist/`, no `tsc` emit.
- **`typescript` is a dev-only dependency**, used solely for `tsc --noEmit`
  type-checking. It is NOT installed in the Docker image (`npm ci --omit=dev`).
- **Relative imports MUST use `.ts` extensions** (e.g. `import { x } from "./config.ts"`).
  Node's resolver does not rewrite `.js`→`.ts`; `.js` specifiers fail at runtime.
- **Only erasable TS syntax is allowed** (interfaces, type aliases, annotations,
  `as`, `!`, `import type`). Do NOT use enums, namespaces, parameter properties, or
  constructor shorthand — Node's type-stripping rejects them.
- `tsconfig.json` is `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`
  + `allowImportingTsExtensions` + `noEmit`, `module/moduleResolution: nodenext`.
  Honor `verbatimModuleSyntax`: type-only imports use `import type`.

## Commands

```bash
npm install          # install deps (incl. dev types)
npm start            # node src/index.ts
npm test             # tsc --noEmit && node --test  (type-check + tests)
npm run typecheck    # tsc --noEmit only
docker compose up --build
```

Run a single test file: `node --test test/tram.test.ts`.

## Layout

```
src/
  index.ts          # createApp(config, deps) + bootstrap; registers plugins, auth, preview
  config.ts         # loadConfig(env): validate required env vars, fail fast
  auth.ts           # createAuthMiddleware(secret): Bearer-token, timing-safe compare
  ptv/sign.ts       # signRequest(apiKey, path): HMAC-SHA1 uppercase hex
  ptv/client.ts     # createPtvClient({userId, apiKey, fetchImpl}): getDepartures()
  ptv/types.ts      # PTV API response types
  plugins/tram.ts   # shapeDepartures() (pure), fetchTramData(), parseStopId(), createTramPlugin()
  plugins/tram.liquid  # tram's TRMNL markup (full layout); declared by the plugin as templateUrl
  preview.ts        # createPreviewHandler({templateUrl, loadData}): renders a plugin's template to HTML
  plugin.ts         # shared Plugin interface (imported by every plugin)
  time.ts           # formatMelbourneTime (Australia/Melbourne) shared helper
  cache.ts          # SummaryCache: createMemoryCache + createRedisCache (TTL'd, lazy)
  hn/client.ts      # createHnClient: getTopStories (Algolia search), getTopComments
  hn/article.ts     # fetchArticleText via @mozilla/readability + jsdom (best-effort)
  hn/types.ts       # HN Algolia response types + normalised HnStory
  llm/claude.ts     # createClaudeSummarizer (Anthropic Messages API) + noopSummarizer
  plugins/hackernews.ts     # HN plugin: domainFromUrl, fetchHackerNewsData (shapes inline), createHackerNewsPlugin
  plugins/hackernews.liquid # hackernews TRMNL markup (full layout)
test/               # node:test suites (*.test.ts) + fixtures/ptv-departures.json
```

Templates are per-plugin: each plugin declares its own `templateUrl` (a `.liquid`
file co-located in `src/plugins/`), and the preview handler renders whichever
template it's given — there is no single global template.

## Conventions and patterns

- **Dependency injection for testability.** The PTV client takes `fetchImpl`; the
  tram plugin and `createApp` take `client` and `now`. Tests inject fakes — **no
  test hits the network or the real clock.** Preserve this: don't call `fetch`,
  `new Date()`, or construct a real client inside request handlers.
- **Pure shaping.** `shapeDepartures(data, now, opts)` is pure; `now` is passed in.
  Keep time/formatting deterministic and inject `now` rather than reading the clock.
- **Auth is global.** `app.use(createAuthMiddleware(secret))` in `createApp` gates
  **every** route, including `/preview/*` (which can call the PTV API). Plugin
  routes are registered without per-route auth. Don't add an unauthenticated route.
- **Error contract:** bad/missing Bearer token → `401`; PTV upstream failure → `502`.
  TRMNL keeps the last good render on a failed poll, so 502 is the right signal.
- **Adding a plugin:** create `src/plugins/<name>.ts` exporting
  `{ name, route, handler, templateUrl }` (handler is an Express `RequestHandler`;
  `route` is the sub-path under `/plugins`, e.g. `/tram/:stopId`; `templateUrl` is a
  `new URL("./<name>.liquid", import.meta.url)` to its co-located template), then add
  it to the `plugins` array in `src/index.ts`. It's mounted at `/plugins${route}`.
- **Routes:** `/plugins/tram/:stopId` (JSON), `/preview/tram/:stopId` (local-dev
  HTML; `?mock=1` renders the fixture and ignores the stop id). Both are
  authenticated (auth is global). Invalid stop id → `400`; missing → `404`. No
  `/health` route. The hackernews plugin adds `/plugins/hackernews` (JSON) and
  `/preview/hackernews` (local-dev HTML; `?mock=1` renders the bundled fixture).
  Both are authenticated (auth is global); neither takes a path param.

## PTV API notes

- Auth = `devid` query param + HMAC-SHA1 `signature` of the request path (signed
  with the API key, uppercase hex), appended as `&signature=`. See `ptv/sign.ts`.
- The departures response has top-level `departures[]` plus lookup objects
  (`stops`, `routes`, `directions`, `runs`) keyed by id (as strings). Departures
  reference `route_id`, `direction_id`, `run_ref`. Use `estimated_departure_utc`
  (real-time) when present, else `scheduled_departure_utc`.
- Times are formatted in **Australia/Melbourne** via `Intl.DateTimeFormat`.

## Environment variables

`PTV_USER_ID`, `PTV_API_KEY`, `SERVER_SECRET` (Bearer token TRMNL must send) are
required; `PORT` defaults to 8080. They live in `.env` (gitignored, never commit it).
`config.ts` validates the required ones at startup and throws if any are missing.

`ANTHROPIC_API_KEY` (optional — enables the hackernews plugin's AI summaries; without
it stories render summary-less) and `REDIS_URL` (optional — defaults to
`redis://localhost:6379`, set to `redis://redis:6379` in docker-compose) are also read.

`SKIP_AUTH` (`"1"`/`"true"`) is an optional **local-only escape hatch**: when set,
`createApp` skips the auth middleware entirely (logs a warning) so previews work
without a Bearer token. Never set it in production — it makes every route public.

## Testing expectations

- Use the built-in `node:test` runner + `node:assert/strict`. No Jest/Vitest.
- Prefer behavioral tests with injected fakes over mocking internals.
- `test/fixtures/ptv-departures.json` is the canonical PTV sample, shared by the
  shaping tests and the `?mock=1` preview. The expected time strings and the HMAC
  signature in tests are real precomputed values — if they mismatch, the code
  changed; don't "fix" the test by editing the expected value without understanding why.
