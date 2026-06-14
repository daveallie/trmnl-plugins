---
name: building-trmnl-templates
description: Use when writing or editing a plugin's .liquid template, building or debugging the TRMNL markup/layout a plugin renders, choosing a view size, or figuring out how content will render on the TRMNL e-ink display.
---

# Building TRMNL Templates

## Overview

Each plugin in this repo ships a `.liquid` template (`src/plugins/<name>.liquid`)
that the TRMNL framework renders onto an **e-ink** display. The framework is a
fixed-size, non-scrolling CSS design system scoped under `.trmnl`. This skill is
about authoring that markup and iterating on it locally before deploying.

The server side (handler, route, JSON shaping) is owned by `CLAUDE.md` — this
skill is only the rendering layer.

**Core constraints, internalize these:**
- The screen is **fixed (800×480 landscape default) and cannot scroll.** Content
  that doesn't fit is clipped. Plan for the worst-case data volume.
- Design for **1-bit (black & white) first.** Many devices fake gray/color with
  dither patterns — never rely on subtle grays or hue to convey meaning. Use
  contrast, weight, size, borders, and layout instead.
- Templates are validated **by eye via the local preview**, not by automated
  tests. There is no unit test that proves a layout looks right.

## Authoring workflow

1. **Know the data shape.** Read the plugin's handler / `shapeDepartures`-style
   function to see exactly what JSON keys the template receives. Those are your
   Liquid variables. (Templates render with **liquidjs** — standard Shopify-style
   `{{ }}` / `{% %}` syntax.)
2. **Pick the view size** — `view--full` for a single dedicated view, or a
   `mashup` of smaller views. Your template's root element is `.view`; the
   preview/dashboard supplies the `.trmnl > .screen` wrapper. See the cheat-sheet.
3. **Build with framework classes, not ad-hoc CSS.** Reach for the framework's
   layout/typography/element/component classes before writing inline `style=`.
   Use the **Elements** (`title` `value` `label` `description` `divider`) and
   **Components** (`item` `table` `progress` `columns`) rather than raw markup.
   Inline `style=` is acceptable for the gaps the framework genuinely doesn't
   cover (the tram template does this), but prefer a class when one exists.
4. **Handle variable-length data with modulations.** If a list/table/value can
   overflow, use the `data-*` engines (`data-overflow`, `data-clamp`,
   `data-value-fit`, `data-table-limit`) instead of `overflow:hidden`. See the
   cheat-sheet's Modulations table.
5. **Preview and iterate locally** (below) until it looks right, THEN paste the
   template into the TRMNL dashboard.

## The local preview loop

`src/preview.ts` renders a plugin's template to HTML, wrapped in
`.trmnl > .screen` with the live framework CSS (`trmnl.com/css/latest/plugins.css`)
at 800×480 — i.e. what the device sees. The preview route is **auth-gated** (auth
is global), so send the Bearer token. Use `?mock=1` to render the bundled fixture
without hitting the upstream API.

```bash
npm start   # in one shell; needs .env with SERVER_SECRET etc.

# in another shell — render, save, open in a browser:
curl -s -H "Authorization: Bearer $SERVER_SECRET" \
  "http://localhost:8080/preview/tram/1234?mock=1" > /tmp/trmnl.html
open /tmp/trmnl.html
```

Edit the `.liquid`, re-run curl, refresh. Iterate here — it's the only honest
check that the layout fits and reads well on the fixed screen. (`?mock=1` ignores
the stop id and uses `test/fixtures/`; drop it to exercise real upstream data.)

When adding a brand-new plugin you must also register a `/preview/<name>/...`
route in `src/index.ts` (mirror the tram block) so it can be previewed.

## Common mistakes

- **Emitting `.trmnl` or `.screen` in the template.** Don't — the harness wraps
  your `.view`. Start at `<div class="view view--full">`.
- **Nesting `.title_bar` inside `.layout`.** They are **siblings** under `.view`.
- **Relying on color/gray to distinguish things.** Fails on 1-bit devices.
- **Assuming content scrolls.** It clips. Use a modulation or constrain the data.
- **Reaching for a chart by reflex.** Charts need JS (Highcharts/Chartkick) and
  are screenshot-fragile; most data here renders fine as CSS values/tables.
- **Inventing class names.** If unsure a class exists, check the cheat-sheet or
  WebFetch the doc page — don't guess.

## Reference

- `reference/framework-cheatsheet.md` — view sizes, structure, layout/typography
  utilities, elements, components, colors, and the modulation `data-*` attributes.
  Covers the common cases offline.
- `reference/doc-map.md` — every framework doc slug + when to fetch it for the
  long tail. WebFetch `https://trmnl.com/framework/docs/3.1/<slug>`.
- `src/plugins/tram.liquid` — the in-repo worked example (a `view--full` layout
  with a title bar).
