# trmnl-plugins

A small Node/Express server (TypeScript) that hosts [TRMNL](https://usetrmnl.com)
private plugins using the **polling** strategy. Each plugin is mounted at
`/plugins/<name>` and returns JSON that TRMNL renders with a Liquid template.

The server is written in TypeScript and runs **without a build step**: Node 24
strips types at runtime, so the `.ts` sources execute directly
(`node src/index.ts`).

## Plugins

### Tram times (`/plugins/tram/:stopId`)

Upcoming tram departures from a PTV stop (route type 1, trams). The stop id is a
required path segment, e.g. `/plugins/tram/2070`. Returns up to 5 departures,
soonest first, using real-time estimates when available. A non-numeric stop id
returns `400`; omitting it (`/plugins/tram`) is `404`.

Response shape:

```json
{
  "stop_name": "Glenferrie Rd/Dandenong Rd",
  "updated_at": "1:00 pm",
  "departures": [
    { "route": "3", "destination": "Moonee Ponds", "minutes": 2, "time": "1:02 pm", "realtime": true }
  ]
}
```

## Configuration

Set these in `.env`:

| Var             | Required | Description                                   |
|-----------------|----------|-----------------------------------------------|
| `PTV_USER_ID`   | yes      | PTV API user / devid                          |
| `PTV_API_KEY`   | yes      | PTV API key (used to HMAC-sign requests)      |
| `SERVER_SECRET` | yes      | Bearer token TRMNL must send to authenticate  |
| `PORT`          | no       | Listen port (default 8080)                    |

## Run

Locally (Node 24+):

```bash
npm install
npm start            # node src/index.ts
```

Docker:

```bash
docker compose up --build
```

Tests (type-check + unit/integration tests):

```bash
npm test             # tsc --noEmit && node --test
npm run typecheck    # tsc --noEmit only
```

## Preview without TRMNL

Open `http://localhost:8080/preview/tram/2070` to render the Liquid template with
live PTV data for a stop, or `http://localhost:8080/preview/tram/2070?mock=1` to
render from the bundled fixture (no network / no PTV credentials needed; the stop
id is ignored in mock mode).

> The `?mock=1` fixture lives under `test/`, which is excluded from the Docker
> image — mock preview is a local-development affordance. The live preview works
> in the container.

## Configure the TRMNL private plugin

1. Create a private plugin in TRMNL, strategy **Polling**, method **GET**.
2. Polling URL: `https://<your-host>/plugins/tram/<stopId>` (e.g. `.../plugins/tram/2070`)
3. Add a header: `Authorization = Bearer <SERVER_SECRET>`
4. Paste the contents of `template.liquid` into the plugin's markup.

The returned JSON keys (`stop_name`, `updated_at`, `departures`) are available
directly as Liquid variables.

## Project layout

```
src/
  index.ts          # createApp() + bootstrap; wires plugins, auth, preview
  config.ts         # loadConfig(): validate env vars, fail fast
  auth.ts           # Bearer-token middleware (timing-safe)
  ptv/sign.ts       # HMAC-SHA1 request signing
  ptv/client.ts     # PTV departures client (injectable fetch)
  ptv/types.ts      # PTV API response types
  plugins/tram.ts   # tram shaping + plugin handler
  preview.ts        # /preview/<name> HTML renderer
test/               # node:test suites + fixtures
template.liquid     # sample TRMNL markup (full layout)
```

Adding a plugin: create a module under `src/plugins/` exporting `{ name, handler }`,
then register it in the `plugins` array in `src/index.ts`.
