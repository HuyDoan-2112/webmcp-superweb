# SuperWeb

A WebMCP demonstration built on Kestrel Supply Co., a fictional electronics
supplier. The application registers its own tools in the page, so an agent
operates the real product through the same code path a click takes, rather than
through a parallel API or a hosted MCP server.

| | |
|---|---|
| Live | [webmcp-superweb.vercel.app](https://webmcp-superweb.vercel.app) |
| Demo video | _to be added_ |
| Agent brief | [llms.txt](https://webmcp-superweb.vercel.app/llms.txt), the site described for an agent arriving without WebMCP |
| Licence | MIT, see [LICENSE](LICENSE) |
| Built for | the [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/). First commit Aug 27 2026, no prior work |

## Overview

One origin serves two surfaces, and the registered tool set follows which one is
open.

**The public storefront** is a trade catalogue of 28 photographed products.
Its tools search and filter the real catalogue, open and compare products,
manage a cart and wishlist, file trade enquiries, switch between five locales,
and read Kestrel's authored profile for a product family. That profile carries
named looks, styling treatments written in the vocabulary a photo editor uses,
which a caller can hand to an image model to restyle a photograph the person
already supplied.

**The internal dashboard** appears once someone signs in. Its tools answer
metric questions, break any metric down along any dimension, check whether a
given slice is trustworthy, draft a multi-section report, and trace a number's
lineage back to the system it came from. A report cannot be exported until a
person approves it on the page.

Three constraints hold across both:

- **Nothing is measured that the data does not record.** The catalogue holds
  price, colour, weight, brand and category. It holds no sensor size, aperture,
  wattage or decibel figure, so profiles are Kestrel's own words and every
  response carries a block saying so.
- **No image data passes through WebMCP.** Tools return structured product data
  and a labelled recipe. Any image edit happens as a separate step in the
  agent's own environment. Multimodal input and output remain open work in the
  spec.
- **A number without evidence behind it does not reach the page.** The report
  tools read the pipeline's own quality checks and refuse rather than publish.

## Where WebMCP fits

The [WebMCP explainer](https://github.com/webmachinelearning/webmcp) states five
goals and four non-goals. This build is organised around them.

| Goal | How SuperWeb meets it |
|---|---|
| Human-in-the-loop workflows | The page moves visibly as the agent works, because tools call the same store setters a click calls. `build_deck` refuses until a person presses Approve, and no registered tool can press it |
| Simplify agent integration | Schemas carry real enums built at registration time from live data, so the agent cannot name a category, metric or promotion that does not exist. No DOM scraping and no simulated clicks |
| Prevent disintermediation | Tools drive the front end; the front end calls `/api/*`, the same path a click takes. The application is not bypassed by a backend integration, it is the integration |
| Code reuse | `search_catalog_form` is the catalogue's existing accessible search form plus three HTML attributes. The browser synthesises the schema from the markup, with no JavaScript and no second code path |
| Accessibility through agents | The agent operates the same labelled controls a screen reader announces, rather than a parallel surface that can drift from them |

| Non-goal | How this build honours it |
|---|---|
| Headless browsing | State lives in the page. The tool surface exists only while the page is open, and the probes drive real Chrome |
| Fully autonomous workflows | The approval gate is this line. The agent decides what may be written; the person decides whether it may be sent |
| Replacing backend integrations | `/api/*` stays an ordinary read-only API. No tool composes SQL or touches DuckDB |
| Replacing the human interface | Every tool moves a control a person could have moved. There is one state path, not a hidden copy of the application |

## WebMCP tools reference

Registration follows page state, never identity. The surface stays small while
the answerable space stays large: `breakdown_metric` alone answers roughly forty
questions, six metrics against eight dimensions, from one registration.

**Public surface**, signed out. Eleven written in TypeScript, one registered by
the browser from HTML, and one that appears only on a profiled product.

| Tool | Registered | Does |
|---|---|---|
| `search_products` | catalogue | Free text and facet search |
| `get_product` | catalogue | One product family by code or name |
| `compare_products` | catalogue | Two or more families side by side |
| `filter_catalog` | catalogue | Moves the grid's filters and paging |
| `set_language` | catalogue | Switches the storefront locale, five available |
| `list_promotions` | catalogue | Live offers for a given date |
| `check_promotion` | catalogue | Whether a promotion's claim survives its trust check |
| `plan_promotion_reminder` | catalogue | Hands a scheduler the shape of a reminder |
| `manage_cart` | catalogue | Add, remove, read the basket |
| `manage_wishlist` | catalogue | Add, remove, read the wishlist |
| `send_enquiry` | catalogue | Files a trade enquiry against a product |
| `search_catalog_form` | catalogue | **Declarative**, synthesised from the search form's markup |
| `get_preview_recipe` | a profiled product is open | Kestrel's notes on that product family, and its named looks |

Profiles exist for 18 subcategories. A Digital SLR carries sixteen looks, four
written for that kind of camera and twelve house looks shared across the shop.
Most of the catalogue has no profile, so the tool is genuinely absent on a
kettle.

**Internal surface**, signed in. The public eleven unregister and these take
their place, so the count dips before it climbs.

| Tool | Registered | Does |
|---|---|---|
| `list_metrics` | dashboard | What is answerable at all |
| `get_metric` | dashboard | One metric for a period, optionally as a chart |
| `breakdown_metric` | dashboard | Any metric along any dimension |
| `describe_metric` | dashboard | What a metric means and how it is computed |
| `check_data_trust` | dashboard | The verdict for one metric, period and slice |
| `filter_dashboard` | dashboard | Moves the dashboard's own controls |
| `start_report` | dashboard | Opens the report builder |
| `list_enquiries` | dashboard | Trade enquiries filed from the catalogue |
| `draft_report` | the report is open | Drafts every section, refusing what cannot be published |
| `build_deck` | the report is open | Lays the approved draft out as slides |
| `explain_data_issue` | a check came back not-ok | One sentence a non-technical person can use |
| `trace_lineage` | a check came back not-ok | Walks the chain from the number back to the source system |

## How WebMCP is implemented

Tools live in `src/mcp/tools/` and register from `src/mcp/register.ts`. The
recipe for adding one, and the reasons not to, are in
[src/mcp/README.md](src/mcp/README.md).

**A form with three attributes is a tool.** The catalogue search box carries
`toolname`, `tooldescription` and `toolautosubmit`, with `toolparamdescription`
on its fields, and Chrome registers it as `search_catalog_form` with no
JavaScript. The browser synthesises the schema from the markup, so `<select>`
options become an enum and `required` becomes the required array. Calling it
fills the real input, runs the page's own submit handler, and answers through
`SubmitEvent.respondWith`. The browser enforces code reuse here rather than a
developer remembering to. The limit is annotations, which cannot be expressed
declaratively, so this tool answers with a count and hands off to
`search_products` for the rows, since product copy is third-party text.

**Tools drive the page, they do not compose SQL.** A tool that moves the page
calls the same store setter a click calls. A tool answering a question reads the
same `/api/*` endpoint the page reads. Neither half touches DuckDB.

**Sequencing happens through return values, and decisions come back as data
too.** A tool's response is context the agent reads, so that is where the next
step gets steered. `check_data_trust` and `draft_report` append a JSON block
carrying the same answer as fields, because WebMCP validates tool input and says
nothing about output. A blocked section omits the figure key entirely rather
than sending null or zero, since the dashboard renders `$0` for a blocked slice
and "we counted zero" must not serialise like "nothing was counted". Every
answer carries `dataAsOf` and `answeredAt`.

**`readOnlyHint` is claimed sparingly.** MCP defines it as "does not modify its
environment", and the page is the environment, so only tools that move nothing
carry it. Tools register only from our own modules, never from fetched content,
because runtime registration has a published attack surface.

**What the probes found**, rather than what the explainer states. Unregistering
means aborting the `AbortSignal` passed to `registerTool`; there is no
`unregisterTool`. `getTools()` returns `inputSchema` as a string, and
`executeTool` is a string on both sides, so a caller reading `result.content`
gets undefined and an empty answer with no error. `navigator.modelContext` is
the same object, not a dead spelling. A declarative tool's lifetime is its
element's: signing in unmounts the search form and the browser drops
`search_catalog_form` on its own, with no code of ours.

## Data and the trust layer

`etl/` runs DuckDB over the Contoso dataset, bronze to silver to gold, and
writes the quality checks and run metadata that everything downstream reads.
`api/` serves the resulting parquet read-only. `/api/query` is the only endpoint
that aggregates, and it composes every column from `shared/metrics.ts`: filter
values bind as parameters, and metric and dimension names are looked up in the
registry and rejected if absent, so the only strings reaching SQL text are ones
this repository wrote. `/api/trust` reads the checks the ETL recorded rather
than recomputing them, because the rows that would prove a completeness failure
are the ones that are missing.

The demonstration period, November 2023, is missing a month of euro exchange
rates, so order lines that needed one fell out of the pipeline: 7,831 of 31,084.
France, Germany, Italy and the Netherlands lose every line, so those slices
carry no publishable figure. The Online channel keeps 14,043 of its 18,831 lines
and produces a figure that looks ordinary and is roughly a quarter short.

That gap is injected on purpose by two lines in `etl/sql/01_bronze.sql`, because
Contoso ships complete coverage and there is no natural gap to point a tool at.
Everything downstream is real: the join fails, `checks.py` records it, and
`npm run etl` reproduces every count.
[docs/adr/0003](docs/adr/0003-the-fx-gap-is-planted.md) names the line.

The session decides how deep an answer goes, never whether a question may be
asked. `check_data_trust` on the same slice answers an operations audience with
plain language and a data platform audience with the check name and the row
counts. Registration happens in the browser and is not a security boundary,
which is why the server decides depth: see `api/_lib/session.ts`.

## Getting started

```bash
npm install
npm run dev          # the whole application on :5173
```

No second terminal and no Vercel login. In production `api/` runs as Vercel
serverless functions; locally `vite-api-plugin.ts` loads the same handler
modules through Vite. The committed gold parquet runs everything; to regenerate
it see [etl/README.md](etl/README.md).

WebMCP needs a browser exposing `document.modelContext`: Chrome with
`--enable-features=WebMCP`, or ChatGPT's in-app browser. The deployed origin
carries an origin trial token, so no flag is needed there. Clear site data
first, since a leftover session cookie opens the application on the dashboard
and skips the surface swap.

## Testing

Each script spawns its own Chrome, so `npm run dev` is the only thing you start.

```bash
npm run verify                     # typecheck and build
node docs/probe-modelcontext.mjs   # the browser API surface
node docs/probe-report-flow.mjs    # the report flow, driven as an agent
node docs/probe-preview.mjs        # the preview recipe appearing and going away
npm run eval                       # 20 deterministic scenarios, pass or fail
```

`npm run eval` is the deterministic half of Chrome's suggested WebMCP
evaluation: every scenario calls a tool with fixed arguments and asserts on what
came back, so it measures what the tools do. Whether a model picks the right
tool or recovers from an ambiguous prompt is not measured anywhere in this repo
and is not claimed. It asserts exact figures and needs the committed gold
parquet; pass `--url=` to run it against the deployment.

## Project structure

| Path | Contains |
|---|---|
| `src/mcp/` | Registration, the panel, every WebMCP tool. [Recipe here](src/mcp/README.md) |
| `src/mcp/profiles.ts` | The authored profiles and looks, 18 subcategories |
| `src/ui/`, `src/components/` | Storefront, dashboard, report, lineage ladder |
| `src/store.ts` | The one state path a click and a tool both take |
| `shared/` | Types and the metric registry, read by both sides |
| `api/` | Read-only serverless endpoints, one file each |
| `etl/` | Python and DuckDB, bronze to silver to gold |
| `data/` | Committed gold parquet, pipeline metadata, the photographed range |
| `docs/` | Probes, the scenario suite, decision records |

The storefront is the 28 photographed products in
`data/meta/catalog-products.json`, so no card shows a picture of something else.
The warehouse behind it keeps the full Contoso dimension, 2,517 rows in 885
families, which is what the dashboard aggregates.

| Layer | Choice |
|---|---|
| Frontend | Vite, React 19, Tailwind, shadcn/ui, framework-agnostic store |
| Backend | Vercel serverless functions, DuckDB, read-only |
| Data | Contoso Data Generator V2, 1M-order tier, MIT |
| Auth | Demo session. Identity, not security. No passwords |

[SUBMISSION.md](SUBMISSION.md) is the guided walkthrough with every number
traced to its file. [CONTEXT.md](CONTEXT.md) is the glossary,
[CLAUDE.md](CLAUDE.md) the working context,
[docs/open-questions.md](docs/open-questions.md) what this build measured
against the open spec questions.

## Licence

MIT, see [LICENSE](LICENSE). Every dependency is permissively licensed: Contoso
data MIT, DuckDB MIT, Recharts MIT, shadcn/ui MIT.

The dashboard shell, layout, theme tokens and the shadcn/ui component set, is
adapted from [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin),
MIT, Copyright (c) 2024 Sat Naing. Its licence is retained verbatim at
[vendor/shadcn-admin/LICENSE](vendor/shadcn-admin/LICENSE).

The sample data is Microsoft's Contoso dataset, published to be used this way.
Contoso exists precisely to be the fictional company in demos. It is renamed to
Kestrel Supply Co. for product reasons rather than legal ones: a UI saying
"Contoso" reads as a tutorial built on sample data, one saying Kestrel reads as
a product seeded with it. No Microsoft logo appears and no involvement is
implied. The business it describes is not real.
