# CLAUDE.md

Guidance for AI agents working in this repo.

## What this is

A Node/Express server (TypeScript) that hosts **TRMNL private plugins** using the
**polling** strategy. Each plugin is mounted at `/plugins/<name>` and returns JSON
that TRMNL renders with a Liquid template configured in the TRMNL dashboard. The
server is built to host multiple plugins over time, distinguished by URL path.

First (and currently only) plugin: **tram** — upcoming PTV tram departures for
stop 2070, route type 1.

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
  plugins/tram.ts   # shapeDepartures() (pure) + createTramPlugin(); constants
  preview.ts        # createPreviewHandler({loadData}): renders template.liquid to HTML
test/               # node:test suites (*.test.ts) + fixtures/ptv-departures.json
template.liquid     # sample TRMNL markup (full layout) — also used by /preview
```

## Conventions and patterns

- **Dependency injection for testability.** The PTV client takes `fetchImpl`; the
  tram plugin and `createApp` take `client` and `now`. Tests inject fakes — **no
  test hits the network or the real clock.** Preserve this: don't call `fetch`,
  `new Date()`, or construct a real client inside request handlers.
- **Pure shaping.** `shapeDepartures(data, now, opts)` is pure; `now` is passed in.
  Keep time/formatting deterministic and inject `now` rather than reading the clock.
- **Error contract:** bad/missing Bearer token → `401`; PTV upstream failure → `502`.
  TRMNL keeps the last good render on a failed poll, so 502 is the right signal.
- **Adding a plugin:** create `src/plugins/<name>.ts` exporting `{ name, handler }`
  (handler is an Express `RequestHandler`), then add it to the `plugins` array in
  `src/index.ts`. Auth is applied to all `/plugins/*` routes automatically.
- **Routes:** `/plugins/<name>` (authenticated, JSON), `/preview/<name>`
  (unauthenticated local-dev HTML). There is intentionally no `/health` route.

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

## Testing expectations

- Use the built-in `node:test` runner + `node:assert/strict`. No Jest/Vitest.
- Prefer behavioral tests with injected fakes over mocking internals.
- `test/fixtures/ptv-departures.json` is the canonical PTV sample, shared by the
  shaping tests and the `?mock=1` preview. The expected time strings and the HMAC
  signature in tests are real precomputed values — if they mismatch, the code
  changed; don't "fix" the test by editing the expected value without understanding why.
