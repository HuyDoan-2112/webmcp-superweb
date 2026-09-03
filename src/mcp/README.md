# WebMCP tools

This directory registers the tools that operate SuperWeb. A tool that moves the
page calls an exported setter from `src/store.ts`. A tool that reads data uses
`src/mcp/api.ts`, which wraps the same API client as the React interface.

No file under `src/mcp/` imports DuckDB or composes SQL.

## Decide whether a new tool is needed

Prefer one capability with arguments over several narrow registrations.
`breakdown_metric` covers six metrics and every supported dimension. A separate
tool for each combination would make selection harder and duplicate schemas.

Before adding a tool, answer these questions:

1. Can an existing tool accept one more argument?
2. Can an existing result include the needed field?
3. Is the proposed name tied to one question or date instead of a reusable
   capability?

Add a registration only when all three answers are no.

## Rules every tool follows

- A state-changing tool uses the store. It does not mutate component state or
  the DOM directly.
- A data read goes through `src/mcp/api.ts` and the same `/api/*` endpoint used
  by the page.
- Schema enums come from a real source. Metrics come from
  `shared/metrics.ts`, catalogue facets from `/api/products`, and promotion
  codes from `data/meta/promotions.json`.
- Handlers validate arguments even when the schema contains an enum. The tested
  Chrome build allowed schema violations to reach `execute`.
- Tool factories are imported by `src/mcp/register.ts`. Fetched content never
  creates a descriptor.
- A response names a useful next tool when the workflow needs another step.
- Decisions such as trust verdicts also return a JSON block through
  `src/mcp/structured.ts`.
- A blocked or unchecked report section omits the figure field. It never sends
  `0` as a substitute for missing evidence.
- A person approves a report. No tool calls `approveReport`.

## Registration groups

`src/mcp/register.ts` reconciles five groups against page state. Each group owns
an `AbortController`, and closing it unregisters the group's tools.

| Group | Opens when | Tools |
| --- | --- | --- |
| `public` | The catalogue is visible | Catalogue, promotion, cart, wishlist, and enquiry tools |
| `internal` | Staff has selected the dashboard surface | Metrics, trust, dashboard movement, report entry, and enquiry queue |
| `preview` | A product with an authored profile is open | `get_preview_recipe` |
| `report` | The report builder is open | `draft_report`, `build_deck` |
| `diagnostics` | A check returned a non-`ok` verdict | `explain_data_issue`, `trace_lineage` |

Registration follows visible context, not authorization. The staff cookie only
changes answer depth. It is not a security boundary.

The product surface excludes the temporary `webmcp_probe` in
`src/mcp/register.ts`. That probe uses the simplest one-argument registration
to diagnose partial host support. Remove it before the final deployment because
it adds an unrelated tool that never unregisters.

## Annotations

Set both annotations on every imperative tool.

`readOnlyHint` describes whether the tool changes its environment. The page is
the environment. A tool that calls a store setter uses `false`, even if the
change is reversible. A tool that only reads data uses `true`.

`untrustedContentHint` describes the riskiest content in the result. Product,
brand, manufacturer, and customer-written enquiry text use `true`. Kestrel's
own promotion copy and generated trust prose use `false`.

Declarative tools cannot declare these annotations. For that reason,
`search_catalog_form` returns counts and delegates supplier copy to the
imperative `search_products` tool.

## Add a tool

1. Export a factory under `src/mcp/tools/` that returns `ToolSpec[]`.
2. Pass any live enum source into the factory.
3. In `execute`, validate the arguments before changing state.
4. Call the store setter, then read the API result the page will render.
5. Set `readOnlyHint` and `untrustedContentHint` with a short reason in code.
6. Return a concrete result and name the next step only when one exists.
7. Add the factory to the correct group in `src/mcp/register.ts`.
8. Run `npm run typecheck`, `npm run verify:webmcp`, and `npm run eval`.

A new group needs a page condition that can be false. Promotions stay in the
public group because their committed record always exists. Preview has its own
group because most products have no profile.

## Public tools

The catalogue normally exposes 12 product tools. Eleven are imperative and one
comes from the search form's HTML. A profiled product adds the thirteenth.

| Tool | Behavior |
| --- | --- |
| `search_products` | Moves the search and optional category or brand filters, then lists matching families |
| `get_product` | Opens one product by code, key, or exact name |
| `compare_products` | Reads two to four products without moving the page |
| `filter_catalog` | Sets facets, price bounds, or page number |
| `set_language` | Switches the public interface among five locales |
| `list_promotions` | Lists promotions active on a date |
| `check_promotion` | Opens a promotion and checks its bound metric slice |
| `plan_promotion_reminder` | Returns the promotion window and an RRULE without scheduling anything |
| `manage_cart` | Adds, removes, changes, or reads cart lines |
| `manage_wishlist` | Adds, removes, or reads wishlist products |
| `send_enquiry` | Sends a question from the selected customer session |
| `search_catalog_form` | Declarative search tool generated from the form markup |
| `get_preview_recipe` | Conditional profile and named look for the open product |

`get_preview_recipe` rebuilds when the product key changes. Its `look` enum must
match the product currently open, not the previous one.

## Internal tools

The dashboard opens with eight tools. Opening the report adds two. A failed,
degraded, or unchecked trust result adds two diagnostic tools.

| Tool | Behavior |
| --- | --- |
| `list_metrics` | Lists the six registered metrics and their supported dimensions |
| `get_metric` | Moves the dashboard and reads one period value |
| `breakdown_metric` | Splits a metric by one supported dimension |
| `describe_metric` | Returns the definition, grain, exclusions, and lineage metadata |
| `check_data_trust` | Checks one metric, period, and optional filter |
| `filter_dashboard` | Moves the metric, period, filters, and view |
| `start_report` | Opens the report builder |
| `list_enquiries` | Reads the customer queue or marks an enquiry answered |
| `draft_report` | Checks every section before writing it to the page |
| `build_deck` | Returns a slide outline after human approval |
| `explain_data_issue` | Converts a failed check to plain language |
| `trace_lineage` | Opens the lineage chain and marks the failed stage |

## Verification notes

`docs/probe-modelcontext.mjs` checks the API shape and the public-to-internal
swap. `docs/probe-preview.mjs` checks the conditional preview tool.
`docs/probe-report-flow.mjs` checks the report gate. `docs/eval-tools.mjs`
runs 20 fixed scenarios through the browser's tool API.

The probes require a running app and launch Chrome themselves:

```bash
npm run dev
npm run verify:webmcp
npm run eval
```
