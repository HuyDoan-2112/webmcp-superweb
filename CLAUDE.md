# CLAUDE.md

This file is the entry point for coding agents working in SuperWeb. Read the
smallest document that owns the part you are changing:

- Changes under `src/mcp/` require [src/mcp/README.md](src/mcp/README.md).
- Changes under `etl/`, `data/`, or `api/` require
  [etl/README.md](etl/README.md).
- Changes to a settled design require the matching file in
  [docs/adr/](docs/adr/).
- Naming work requires the glossary in this file.

Read the repository rules below before editing any file.

## What SuperWeb is

SuperWeb is a WebMCP demonstration for the fictional Kestrel Supply Co. One
origin contains a public trade catalogue and an internal revenue dashboard.
The page registers a different tool set for each visible surface.

The project tests one claim: an agent should not write down a number unless it
can also see the pipeline evidence behind that number.

## Architecture rule

A WebMCP tool never queries DuckDB or composes SQL. It calls the same store
setter as the visible control, then reads the same `/api/*` endpoint as the
React component.

If code under `src/mcp/` needs a DuckDB import, the code belongs in `api/`
instead.

## Repository map

| Path | Responsibility |
| --- | --- |
| `shared/` | Metric registry and types shared by the API and browser |
| `etl/` | Offline DuckDB pipeline from bronze through gold |
| `data/` | Committed gold parquet and pipeline records |
| `api/` | Read-only Vercel functions |
| `src/store.ts` | State shared by React controls and WebMCP tools |
| `src/ui/` | Dashboard, report, lineage, and catalogue views |
| `src/mcp/` | Registration lifecycle and tool implementations |

Two people share this repository. `shared/` is the highest-conflict area
because it controls server SQL and browser schemas. State your intended
`shared/` change before making it.

## Project rules

- Use named exports. The project has no default exports.
- Add metrics and dimensions in `shared/metrics.ts`. Do not repeat their IDs in
  an endpoint or tool schema.
- Keep `data/gold/` below the Vercel function bundle limit. The current target
  is about 50 MB.
- Preserve user changes already present in the working tree.
- Do not commit. Stage only the files changed for the task and suggest a commit
  message.
- Commit messages contain no co-author trailer, session link, or generation
  footer.

## Writing rules

Use sentence case headings, straight quotes, and plain words. End a sentence
instead of using an em dash. Use a colon only before a list or example.

Name the actor and the mechanism. Write "`checks.py` marks the slice blocked
when every expected row is rejected," not "the pipeline is reliable."

Delete a sentence that could appear unchanged in another project's docs.

## Commands

`package.json` owns the command list. These details are easy to miss:

- `npm run dev` serves the React app and `api/*.ts` in one Vite process.
- `npm run verify` runs the required type-check and production build.
- `npm run etl` rebuilds `data/gold/` and generated files under `data/meta/`.
  It leaves `data/meta/catalog-products.json` unchanged.
- `node docs/validate-catalog.mjs` checks the product manifest against the JPEG
  files.
- `npm run verify:webmcp` and `npm run eval` launch Chrome themselves. They need
  `--enable-features=WebMCP`, with that exact case.
- `--url=https://webmcp-superweb.vercel.app/` runs a probe against production.

Run `npm run typecheck` before reporting a code task complete. Run the ETL and
catalogue checks when the task changes their inputs or outputs.

## Scope

The staff switcher is identity for the demo, not authentication. The cookie
changes answer depth and the visible surface. It grants no protected access.

GitHub issues 1 through 18 were deleted. Later issues were closed as not
planned. Treat the code and ADRs as the record, not the old issue text.

## Glossary

Use these terms in code, tool descriptions, and documentation.

### Product and page

- **SuperWeb** is the product, including the React interface and its WebMCP
  tools.
- **Kestrel Supply Co.** is the fictional company shown by the application.
  Contoso is the upstream dataset.
- **Public surface** is the signed-out catalogue and its tools.
- **Internal surface** is the staff dashboard and its tools. A surface controls
  registration. An audience controls answer depth.
- **Family** is one product across all colourways. A variant is one source row
  with its own product code.
- **Facet** is a catalogue filter value with a family count. A dimension is an
  axis used to split a metric.
- **Declarative tool** is registered by the browser from HTML attributes. An
  **imperative tool** is registered from TypeScript.

### Metrics and pipeline

- **Metric** is one business quantity defined in `shared/metrics.ts`.
- **Dimension** is an axis supported by a metric, such as country or channel.
- **Grain** is the row level at which a metric aggregates.
- **Period** is the explicit month attached to a metric request.
- **Run** is one execution of the pipeline.
- **Check** is a named assertion evaluated during a run.
- **FX rate** converts a local-currency amount to USD for one currency and day.
- **Rejected row** is an order line removed because a required lookup failed.
  It is absent, not zero.
- **Completeness** asks whether every expected row is behind a number.
- **Lineage** is the ordered chain from a metric to its source system. A
  **stage** is one labelled item in that chain.

### Trust and reports

- **Audience** controls how much technical detail an answer contains. It never
  decides whether someone may ask.
- **Approval** is the person's decision that a drafted report may leave the
  page. Only the **Approve for export** button records it.
- **Report scope** is the metric and period stored with drafted sections.
- **Blocked section** has no figure because the pipeline rejected at least half
  of its expected rows.
- **Degraded section** keeps its figure and states the missing-row gap beside
  it.
- **Unchecked** means the pipeline recorded no check for the exact slice. It is
  neither a pass nor a softer failure.

### Promotions and profiles

- **Promotion** is synthetic Kestrel copy with a date window and one claim.
- **Claim** is the checkable statement bound to one metric slice.
- **Announcement** is the public strip that displays a promotion.
- **Profile** is Kestrel's written guidance for a product subcategory. It is not
  a specification.
- **Look** is a named photo treatment suggested by Kestrel. It is applied after
  capture and is not camera behavior.
- **Recipe** is the field-by-field instruction for one look. It is not a preset,
  measurement, or hardware promise.
