# Can a Vercel function render a chart PNG, and with what?

Research for issue #23, child of map #20. Branch `research/chart-rendering`.
Date: 2026-08-30. Nothing here has been deployed; everything marked *measured*
was run locally on this machine against this repo's own `node_modules`.

## Short answer

Yes, and the cheapest path adds **zero dependencies**: render the existing
Recharts chart with `react-dom/server` and return the SVG. Measured here at
**19 ms cold, 6 ms warm, 19.6 KB** for a 30-point area chart at 720x320, using
`recharts@2.15.4` and `react@19.2.8` already in this repo.

If a raster PNG is genuinely required, add exactly one dependency,
`@resvg/resvg-js`, and one bundled `.ttf`. Measured end to end: the Recharts SVG
above rasterised to a **20.8 KB PNG in 17 ms**.

Both paths let the endpoint and the React app share one chart module. That is
the part that matters, so it has its own section below.

## What was measured, and how

Two probe scripts, run against `E:/WebMCP/node_modules` on Node v24.12.0
(Windows). They are not committed; the results are reproduced here.

**Probe 1 - Recharts under `renderToStaticMarkup`.** Built an `AreaChart` with
`CartesianGrid`, `XAxis`, `YAxis`, `Area` through `React.createElement`, 30 data
points, explicit `width={720} height={320}`.

```
node: v24.12.0   recharts: 2.15.4   react: 19.2.8
render ms: 19  bytes: 19650   (warm render: 6 ms)
has <svg>: true   paths: 2   texts: 35
responsive bytes: 94   has <svg>: false
```

Three facts fall out of that:

1. **Recharts renders fully server-side.** All 35 axis labels and both area
   paths are in the markup. No DOM, no jsdom, no browser.
2. **`ResponsiveContainer` renders nothing on the server** - 94 bytes, no
   `<svg>` element. It measures its parent in the browser and there is no parent
   to measure. The server path must pass explicit `width`/`height`.
3. **The output is wrapped in a `<div class="recharts-wrapper">`** and the
   `<svg>` element carries **no `xmlns` attribute** (React does not add one for
   `renderToStaticMarkup`). Serving it standalone means slicing from `<svg` to
   `</svg>` and injecting `xmlns="http://www.w3.org/2000/svg"`.

**Probe 2 - rasterising that SVG with `@resvg/resvg-js@2.6.2`.**

```
no-xmlns:         THREW "SVG data parsing failed cause the document does not have a root node"
with-xmlns:       ok 18886 byte png in 178 ms   (system font DB loaded)
no-system-fonts:  ok 12787 byte png in 4 ms     (all text silently missing)
bundled font:     ok 20761 byte png in 17 ms    (loadSystemFonts:false, fontFiles:[arial.ttf], defaultFontFamily:"Arial")
```

Point 3 above is load-bearing: without the `xmlns` injection resvg refuses the
document outright. And the `no-system-fonts` run is the trap - it **succeeds**,
returns a valid PNG, and every axis label and tick number is simply gone. No
warning, no error. A Lambda filesystem has essentially no fonts, so the naive
port of this code to Vercel produces a chart with no numbers on it and no
failure to alert you. Ship a `.ttf` (roughly 300 KB - 1 MB depending on the
face), pass it via `fontFiles`, and set `loadSystemFonts: false` - that also
takes the render from 178 ms to 17 ms, because loading the system font database
was most of the cost.

## The options, with real sizes

Unpacked sizes from the npm registry (`registry.npmjs.org`, `dist.unpackedSize`
of the latest version, queried 2026-08-30). For libraries with per-platform
optional dependencies, the linux-x64 binary is what actually lands in a Vercel
function, so it is listed separately.

| Option | What ships | Unpacked | Verdict |
|---|---|---|---|
| **SVG only** (`react-dom/server` + Recharts) | already in `package.json` | recharts 4.65 MB + react-dom 7.32 MB, installed, tree-shaken far below that | **Recommended.** Zero new deps. |
| **`@resvg/resvg-js` 2.6.2** | wrapper 0.04 MB + `@resvg/resvg-js-linux-x64-gnu` **4.38 MB** + one font | ~5 MB | **Recommended if PNG is required.** Smallest rasteriser that takes SVG in. |
| `@resvg/resvg-wasm` 2.6.2 | 2.53 MB, no native binary | 2.5 MB | Fallback if native ever misbehaves. Slower, needs an explicit wasm init. |
| `@napi-rs/canvas` 1.0.8 | wrapper 0.13 MB + `canvas-linux-x64-gnu` **33.98 MB** | ~34 MB | Works, but it is a Canvas2D API - you would be **writing a second chart renderer by hand**. Wrong shape for this repo. |
| `sharp` 0.35.4 over hand-written SVG | 0.96 MB + `@img/sharp-linux-x64` 0.43 MB + `@img/sharp-libvips-linux-x64` **18.63 MB** | ~20 MB | sharp's SVG input is librsvg via libvips; resvg is smaller and purpose-built. And "hand-written SVG" means a second drawing path. |
| `@vercel/og` 1.0.2 | 7.75 MB (Satori + resvg wasm) | ~8 MB | First-party and Node-runtime supported, but Satori renders a **flexbox HTML subset**, not arbitrary SVG, and caps the whole payload at **500 KB**. It cannot run Recharts. Right tool for OG cards, wrong tool for a chart. |
| `chartjs-node-canvas` 5.0.0 + `chart.js` 4.5.1 | 0.08 + 6.18 MB, plus `canvas` (node-canvas) | ~7 MB + native cairo stack | Introduces Chart.js as a **second charting library** next to Recharts. Strictly worse than every line above it. |
| headless Chromium (`@sparticuz/chromium` 149 + `puppeteer-core`) | **69.68 MB** + 5.86 MB | ~76 MB | Fits under the limits, but pays a browser launch per cold start for a chart this repo can render in 19 ms. No. |

### Do the platform limits bite?

No, not for any of the first six rows.

- Vercel Function bundle size is **250 MB uncompressed** (Node), with **large
  functions up to 5 GB** on fluid compute, opt-in for existing projects via
  `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`. Fluid compute is on by default for new
  projects. So the 5 GB headroom exists but this never needs it.
- What this repo already puts in every function is the real budget: `vercel.json`
  sets `includeFiles: "data/**"` for `api/*.ts` (~50 MB budgeted), and
  `@duckdb/node-api` drags in a platform binding measured at **37.95 MB**
  installed. Call it ~90 MB before any chart code. Adding 5 MB of resvg is
  noise; adding 34 MB of `@napi-rs/canvas` still fits; adding 76 MB of Chromium
  would put the function around 165 MB and still technically fit. Size is not
  the discriminator here - a second drawing code path is.
- **Native binaries are already proven on this project.** `@duckdb/node-api` is
  a N-API addon and `api/_lib/duckdb.ts` uses it in production today. The usual
  serverless failure mode is a lockfile that only recorded the developer's own
  platform binary; `package-lock.json` here is **lockfileVersion 3** and does
  list every platform variant (`@duckdb/node-bindings-linux-x64`,
  `-linux-x64-musl`, all the `@rollup/rollup-*` targets, and so on), so the
  linux-x64 resvg binary would be installed on Vercel's build container the same
  way. This is the risk that sinks most "native module on Lambda" attempts and
  it is already handled.
- Cold start was **not** measured on Vercel - no deploy was made. The local
  numbers (19 ms SSR, 17 ms raster with a bundled font) are steady-state render
  cost, not cold start. The honest statement is: the SVG path adds no native
  `dlopen` at all, and resvg adds one 4.4 MB `.node` load, against a function
  that already loads a 38 MB DuckDB binding.

## Yes, there is an SVG-only path, and it is the one to take

The ticket asks whether SVG with no rasteriser still yields a URL a browser
displays. It does.

- Serve the markup as `Content-Type: image/svg+xml`. That is the registered
  media type; a browser navigating to the URL renders it as a document, and it
  also works in `<img src>` and in a Markdown `![]()`.
- It must be a well-formed standalone document: `<svg xmlns="http://www.w3.org/2000/svg" ...>`.
  This is exactly the same fix resvg forced above, so the two paths share it.
- **Security note, and it is not theoretical.** MDN: when an SVG is loaded via
  `<img>` or CSS, scripts are disabled and external resources are blocked; when
  it is **viewed directly, embedded in an `<iframe>`, `<object>` or `<embed>`,
  those restrictions do not apply**. A chart URL handed to a human is a URL they
  navigate to directly. Since the endpoint is query-string driven, anything from
  the query string that reaches the output must be escaped.
  `renderToStaticMarkup` escapes text children, which covers the normal case -
  but do not concatenate query parameters into the SVG string by hand, and do
  not accept a caller-supplied title or colour that lands in an attribute
  unvalidated. Validate metric/period/dimension against `shared/metrics.ts` the
  way `api/query.ts` already does with `isMetricId`, and the surface closes.
- The trade is legibility outside a browser: a PNG can be pasted into a deck or
  a doc, an SVG sometimes cannot, and some chat surfaces refuse to inline SVG.
  If the demo shows the human clicking the link, SVG is enough. If the demo
  shows them dragging the image into a slide, ship the PNG.

A pragmatic middle: **one endpoint, `?format=svg|png`**. The SVG branch is the
default and free; the PNG branch is four lines of resvg around the same string.
The rasteriser then costs one dependency and can be cut on the day without
touching the drawing code.

## The thing to call out: the endpoint and the app can share the drawing code

`src/mcp/tools/catalog.ts` opens with the warning that a second code path which
merely happens to agree with the first is the failure this architecture exists
to avoid - and the version in that file did not even agree. Map #20 accepts
"a second code path drawing a chart the React app already draws" as the known
cost of the PNG artifact.

**That cost does not have to be paid.** The app draws with Recharts, Recharts is
React, and React renders on the server. The chart the endpoint rasterises can be
literally the same component tree the browser mounts.

The shape:

- Extract the Recharts children out of `src/ui/chart.tsx` into one presentational
  module - takes `{ series, unit, width, height }`, returns the `AreaChart` with
  its `CartesianGrid`, `XAxis`, `YAxis`, `Area`. No fetching, no store, no card
  chrome.
- `TrendChart` keeps its `ResponsiveContainer` and renders that module's output.
- `api/chart.ts` renders the same module at fixed width/height through
  `renderToStaticMarkup`, slices the `<svg>`, injects `xmlns`, and returns it.

Then the tool's picture is the page's picture by construction, and the artifact
is defensible on exactly the terms the rest of the repo is defensible on.

Four constraints that the shared module has to respect, all of them found while
probing:

1. **No `ResponsiveContainer` in the shared part** - it renders nothing on the
   server (measured: 94 bytes). The container stays in `TrendChart`.
2. **No CSS variables and no Tailwind classes on the drawing.** `src/ui/chart.tsx`
   today uses `stroke="var(--border)"`, `var(--chart-1)` and `className="text-xs"`.
   A standalone SVG has no stylesheet, so `var(--chart-1)` resolves to nothing
   and `text-xs` resolves to nothing. The shared module must take literal colour
   and font-size values (pass them in as props, so the app can still feed them
   from its theme tokens on the client side, and the server passes constants).
3. **Relative imports only.** `api/*.ts` in this repo imports `../shared/metrics.js`
   relatively, not `@shared/...`, because the `@/` and `@shared/` aliases are a
   Vite/tsconfig thing that Vercel's Node builder does not apply. A module under
   `src/ui/` imported from `api/` must not use `@/` internally.
4. **`.tsx` versus `.ts`.** Vercel's Node runtime does accept `api/*.tsx`
   (the official `@vercel/og` docs use `api/og.tsx` for the no-framework case),
   but two things in this repo key on `.ts`: `vercel.json` scopes
   `includeFiles` to `"api/*.ts"`, and `vite-api-plugin.ts` only loads
   `/api/${name}.ts`. Easiest is to keep the endpoint `api/chart.ts` and let it
   import the `.tsx` component; if the endpoint itself needs JSX, both globs
   need widening.

Good news on the dev-server side: `vite-api-plugin.ts` already ends with
`res.end(Buffer.from(await response.arrayBuffer()))`, so it is binary-safe. A
PNG or SVG endpoint works under `npm run dev` with no change to the plugin.

## What the HTTP response needs

For the URL to be clickable, displayable, and cheap:

```
content-type: image/svg+xml; charset=utf-8      (or image/png)
cache-control: public, max-age=300, s-maxage=86400, stale-while-revalidate=604800
```

- **Content type is the whole of "clickable".** There is no download prompt to
  avoid as long as the type is an image type; do not set `Content-Disposition:
  attachment`. `Content-Disposition: inline` is optional and harmless.
- **The query string is part of the Vercel CDN cache key.** Vercel's purge docs
  list the cache key as method + request URL + host + deployment URL + scheme,
  and note query strings are ignored *for static files* - which is the carve-out
  that confirms they count for functions. So `?metric=revenue&period=2023-11` and
  `?metric=orders&period=2023-11` are separate cache entries, and a repeat click
  on the same chart is a CDN hit, not a re-render.
- **To cache at the edge at all, the response must carry one of `s-maxage=N`,
  `s-maxage=N, stale-while-revalidate=Z`.** A bare `max-age` does not put it in
  the CDN. This repo's `api/_lib/http.ts` already does the right thing for JSON
  (`public, max-age=60, s-maxage=300`); the chart can reuse the pattern with a
  longer TTL, since gold parquet only changes when the ETL reruns. Use
  `CDN-Cache-Control` / `Vercel-CDN-Cache-Control` only if the browser TTL needs
  to differ from the CDN TTL.
- Also required for a cache hit: `GET`, no `Authorization` header, no
  `set-cookie`, status 200, response under **10 MB** (20 MB streaming). A 20 KB
  chart is nowhere near. Note the `Authorization` rule if the chart URL ever
  learns about the demo session - a session-varying chart wants `Vary` instead,
  and `Vary` multiplies cache entries.
- Response body cap for a function is 4.5 MB regardless. Irrelevant at 20 KB.
- If the artifact must survive past the deployment, note that the deployment URL
  is in the cache key and preview URLs change per deploy. Point the tool at the
  production domain, not at a deployment URL.

## Cost of the cheapest workable option

**SVG only, zero new dependencies.**

- `package.json` change: none.
- `api/chart.ts`: parse and validate params (reuse `isMetricId` / `parseFilters`
  from `api/_lib/compose.ts`), run the same query `api/query.ts` runs, map rows
  to the series shape, `renderToStaticMarkup`, slice, inject `xmlns`, return
  with headers. **Roughly 60 to 80 lines**, most of it the parameter validation
  that already exists in `api/query.ts` and could be shared instead.
- `src/ui/chart.tsx` refactor: move the chart body into a new presentational
  module and take colours as props. **Roughly 40 to 60 lines moved**, near-zero
  net new.
- One line in `api/_lib/http.ts` if an `svg()`/`png()` helper is wanted next to
  `json()`.

**Adding PNG** costs: `npm i @resvg/resvg-js` (1 direct dependency, 0 transitive,
plus a ~4.4 MB platform binary), one committed `.ttf` in `data/` or `public/`,
and about **10 lines** in the endpoint - construct `new Resvg(svg, { font: {
loadSystemFonts: false, fontFiles: [fontPath], defaultFontFamily: "..." } })`,
`.render().asPng()`. Plus a `vercel.json` `includeFiles` entry so the font file
ships. Budget an hour, most of it spent discovering the font problem, which is
already discovered above.

## Not verified

- Nothing was deployed. Cold-start time on Vercel, and the resvg linux-x64
  binary actually loading in the function, are both unmeasured. The DuckDB
  precedent in this repo makes the second one low risk.
- Whether an imported `.tsx` from `src/ui/` compiles cleanly through Vercel's
  Node builder was reasoned from the docs, not observed.
- How a given agent surface renders an `image/svg+xml` link versus a `.png` link
  in its reply. The tool returns a URL in text either way, per map #20, so this
  affects polish rather than function.

## Sources

Primary only.

- Vercel Functions limits (bundle 250 MB / 5 GB large functions, fluid compute,
  memory, 4.5 MB body): https://vercel.com/docs/functions/limitations
- Vercel CDN cache - required `s-maxage`, `CDN-Cache-Control`,
  cacheable-response criteria, 10 MB / 20 MB caps:
  https://vercel.com/docs/caching/cdn-cache
- Vercel CDN cache keys (method + request URL + host + deployment URL + scheme;
  "query strings are ignored for static files"):
  https://vercel.com/docs/caching/cdn-cache/purge
- `@vercel/og` - Node runtime support, Satori + resvg internals, flexbox-only
  CSS subset, 500 KB bundle cap, `api/og.tsx` example for non-framework projects:
  https://vercel.com/docs/og-image-generation
- resvg-js README - napi and wasm bindings, custom font files, disabling system
  fonts: https://github.com/thx/resvg-js
- `@napi-rs/canvas` README - Skia binding, zero system dependencies, glibc 2.18+,
  Lambda layer guidance: https://github.com/Brooooooklyn/canvas
- chartjs-node-canvas README - `chart.js` peer dependency, node-canvas backend,
  SVG output via the sync API:
  https://github.com/SeanSobey/ChartjsNodeCanvas
- MDN, SVG as an image - script and external-resource restrictions apply in
  image contexts and *not* when the SVG is viewed directly or embedded:
  https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_Image
- Package sizes: `registry.npmjs.org` metadata, `dist.unpackedSize` of the
  latest version of each package, read 2026-08-30.
- In-repo: `vercel.json`, `package-lock.json` (lockfileVersion 3),
  `api/_lib/http.ts`, `api/query.ts`, `vite-api-plugin.ts`, `src/ui/chart.tsx`,
  `src/mcp/tools/catalog.ts`, `tsconfig.json`.
