# TRMNL Framework 3.1 — Cheat-Sheet

Condensed from <https://trmnl.com/framework/docs/3.1>. Covers the classes plugins
actually use. For the long tail (responsive prefixes, every modulation), see
`doc-map.md` and WebFetch the specific page.

The framework is a CSS design system for **e-ink** displays. All selectors are
scoped under `.trmnl`. The default device screen is **800×480** (landscape).

---

## Structural hierarchy (memorize this)

```
.screen                      ← supplied by TRMNL platform & by this repo's preview; DON'T emit it
  .view .view--<size>        ← your template's ROOT element
    .layout                  ← exactly ONE per view; holds your content
    .title_bar               ← SIBLING of .layout (not nested), optional
```

A plugin template starts at `.view` (the preview and the dashboard wrap it in
`.trmnl > .screen` for you). `.layout` and `.title_bar` are **siblings**, both
direct children of `.view`. See this repo's `src/plugins/tram.liquid` for a
worked `view--full` example.

### View sizes (exact spelling — single underscore)
`view--full` · `view--half_horizontal` · `view--half_vertical` · `view--quadrant`

A single view uses `view--full`. Multiple views go inside a `.mashup`.

### Mashup (multi-view) arrangements
`.mashup .mashup--<arr>` wrapping multiple `.view` elements. Arrangements (note
capital L/R/T/B): `1Lx1R` `1Tx1B` `1Lx2R` `2Lx1R` `2Tx1B` `1Tx2B` `2x2`.

### title_bar contents
```html
<div class="title_bar">
  <img class="image" src="..." />      <!-- optional icon -->
  <span class="title">Plugin Name</span>
  <span class="instance">Subtitle / instance label</span>
</div>
```

---

## Layout & arrangement

### `.layout` modifiers
- Direction: `layout--row` · `layout--col`
- Align: `layout--left` `layout--center-x` `layout--right` `layout--top`
  `layout--center-y` `layout--bottom` `layout--center`
- Stretch: `layout--stretch` `layout--stretch-x` `layout--stretch-y`
  (children opt-in with `stretch-x` / `stretch-y`)

### Flex (`flex`)
- Container: `flex` (+ `flex--row|col|row-reverse|col-reverse`)
- Align X: `flex--left|center-x|right` · Align Y: `flex--top|center-y|bottom`
- Distribute: `flex--between|around|evenly`
- Wrap: `flex--wrap|nowrap|wrap-reverse`
- Item: `grow` `shrink-0` `no-shrink` `self--start|center|end|stretch`
  `basis--<n>` `order--first|last|<n>`

### Grid (`grid`)
- Container: `grid` · `grid--cols-<n>` · `grid--wrap` · `grid--min-<size>`
- Child: `col--span-<n>` (spans in a row should sum to the column count),
  `col--start|center|end`, `row--start|center|end`

### Columns component (auto-balanced)
`.columns > .column` inside `.layout` — distributes same-type data across columns
and handles overflow automatically.

### Gap
`gap` (base) · `gap--none|xsmall|small|medium|large|xlarge|xxlarge` ·
`gap--[Npx]` (0–50, no responsive) · `gap--auto` `gap--distribute`

### Size (width / height)
- `w--<n>` `h--<n>` on scale `0,0.5,1…12,14,16,20,24…96`
- `w--full|auto` `h--full|auto`
- Arbitrary px: `w--[Npx]` `h--[Npx]` (0–800); container-query: `w--[Ncqw]` `h--[Ncqh]`
- Min/max: `w--min-<n>` `w--max-<n>` `h--min-<n>` `h--max-<n>`

### Spacing (margin / padding)
`m-- mt-- mr-- mb-- ml-- mx-- my--` and `p-- pt-- pr-- pb-- pl-- px-- py--`,
using the size scale (e.g. `mx--4`, `py--2`).

---

## Typography

| Concern | Classes |
|---|---|
| Weight | `font--regular` (400) · `font--bold` (700) |
| Align | `text--left` `text--center` `text--right` `text--justify` |
| Size | `text--small base large xlarge xxlarge xxxlarge mega giga tera peta` |
| Color | `text--black` `text--white` `text--gray-10`…`text--gray-75` (5-step) |

(`text--<size>` e.g. `text--xlarge`. Sizes run 12px → 170px.)

---

## Elements (atomic `<span>`s, `<div>` for divider)

| Element | Base | Variants |
|---|---|---|
| Title | `title` | `title--small base large xlarge xxlarge` |
| Value | `value` | `value--xxsmall xsmall small base large xlarge xxlarge xxxlarge mega giga tera peta`; `value--tnums` (tabular figures) |
| Label | `label` | sizes `--small base large xlarge xxlarge`; styles `--outline underline gray filled primary success error warning inverted` |
| Description | `description` | `description--large xlarge xxlarge`; `data-clamp="N"` |
| Divider | `divider` | `divider--h` `divider--v`; bg `divider--on-white|light|dark|black` |

`value` is for data/numbers, `label` for captions/tags, `title` for headings,
`description` for body text. Use `value--tnums` for right-aligned numeric columns.

---

## Components

### Item (list row)
```html
<div class="item">
  <div class="meta"><span class="index">1</span></div>   <!-- optional -->
  <div class="icon">…</div>                               <!-- optional -->
  <div class="content">
    <span class="title title--small">Heading</span>
    <span class="description">Detail</span>
  </div>
</div>
```
Emphasis: `item--emphasis-1|2|3`.

### Table
```html
<table class="table" data-table-limit="true">
  <thead><tr><th><span class="title">Col</span></th></tr></thead>
  <tbody><tr><td><span class="label">Cell</span></td></tr></tbody>
</table>
```
Sizes: `table--xsmall|small|base|large|xlarge`. `table--indexed` for row numbers.
`data-table-limit="true"` auto-hides overflow rows and adds an "and X more" row.

### Progress
```html
<div class="progress-bar">
  <div class="content"><span class="label">Progress</span><span class="value value--xxsmall">50%</span></div>
  <div class="track"><div class="fill" style="width: 50%"></div></div>
</div>
```
Also `progress-dots` with `.track > .dot` / `.dot--filled` / `.dot--current`.
Sizes: `--xsmall|small|base|large`.

### Rich Text
`.richtext` (`--left|center|right`) > `.content` (`--<align>`, `--small`…`--xxxlarge`)
holding `<p>` / `.text` — for long-form/markdown-ish body content.

### Chart — NOT pure CSS
Charts render via **Highcharts + Chartkick (JS)**, not markup. You emit an empty
`<div id="chart-x" class="w--full">` and initialize it in JS. Set Highcharts
`height: null` to fill space, and **disable animation** (TRMNL screenshots the
render — animations get half-captured). Most plugins here are server-rendered
JSON; prefer CSS layout over charts unless the data is genuinely a chart.

---

## Color & e-ink model

- Bit depths: **1-bit** (B&W; gray/color faked with dither patterns), 2-bit,
  Density-2x, 4/8/16-bit (solid color). The *same* class resolves to a dither on
  1-bit and a solid tone on richer displays.
- Grayscale tokens: `black` `gray-10`…`gray-75` (5-step) `white`.
- Chromatic hues (10): `red orange yellow lime green cyan blue violet purple pink`,
  each with lightness steps `10`…`75`.
- Semantic: `primary` (blue) `success` (green) `error` (red) `warning` (orange).
- Backgrounds: `bg--<token>` (e.g. `bg--black` `bg--gray-50` `bg--success`).
- Text colors: `text--<token>` (same token set).
- **Design for 1-bit first.** Don't rely on subtle gray differences or color to
  convey meaning — many devices render pure black/white via dithering. Use
  contrast, weight, size, borders, and layout, not hue.

### Styling utilities
- Border (dithered, scale 1=black→7=white): `border--h-1`…`-7`, `border--v-1`…`-7`
- Rounded: `rounded--none|xsmall|small|base|medium|large|xlarge|xxlarge|full`,
  `rounded--[Npx]`, plus corner/side variants `rounded-tl--<n>` etc.
- Image: `image`, object-fit `image--fill|contain|cover`, `image-dither` (1-bit)

---

## Modulations — handling content too big for the fixed screen

The screen is a fixed size and cannot scroll. When data length varies, use these
JS engines (activated by **`data-*` attributes**) instead of hoping it fits:

| Need | Attribute | Notes |
|---|---|---|
| Clamp text to N lines | `data-clamp="N"` | + responsive `data-clamp-sm/md/lg/portrait` |
| Auto-fit a value to its box | `data-value-fit="true"` | + `data-value-fit-max-height="<px>"` for multi-line |
| Limit/distribute a list, "+X more" | `data-overflow="true"` | + `data-overflow-max-cols`, `data-overflow-counter="true"`, `data-overflow-max-height` |
| Truncate a table | `data-table-limit="true"` | on the `.table` |
| Shrink a content area to fit view | `data-content-limiter="true"` | + `data-content-max-height="<px>"` |

Prefer these over hand-rolled `overflow:hidden` — they degrade gracefully and add
"and X more" affordances. (This repo's tram template predates this and hand-rolls
flex distribution; new plugins with variable-length lists should reach for
`data-overflow`.)

## Responsive prefixes

Stack as `breakpoint:orientation:bitdepth:utility` — e.g. `md:portrait:2bit:text--right`.
Breakpoints `sm: md: lg:`; orientation `portrait: landscape:`; bit-depth `1bit: 2bit: 4bit:`.
