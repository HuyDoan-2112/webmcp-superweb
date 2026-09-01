# SuperWeb

**Every internal dashboard needs a person to explain it. WebMCP lets it explain
itself.**

Every organisation has a surface like this. A dashboard holding numbers from
half a dozen departments, read by someone who owns none of them. When they need
to know what a number means or whether it can be trusted, they ask someone else.
That person is busy, and the number gets used anyway.

## Your app is already the integration

Making an application agent-accessible usually means building a second one: an
MCP server, a parallel API, tools reimplementing what the frontend already does.
SuperWeb does none of that. The dashboard exposes its own capabilities as WebMCP
tools, and the agent drives the real application through the same path a click
takes. No backend to change, no service to host.

The answers are better too, because a tool operating the actual product can see
what the product sees, including whether a number deserves to be published.

Built for the OpenAI WebMCP Challenge. The pattern transfers to any internal
surface where the data outnumbers the people who understand it.

## The demonstration

Ask the agent for a revenue report. It cuts the month into one section per
country the pipeline evaluated, publishes four, refuses four, and flags one.

> I can't publish France, Germany, Italy or the Netherlands. Every order line
> behind them lost its exchange rate for this month, so there is no number to
> give you. Online is short about a quarter of its lines for the same reason, so
> that total is understated.

Nobody asked it to check. The business sells in five currencies, so every order
converts to USD at the rate for the day it was placed. A month of euro rates is
missing, so those orders fell out of the pipeline. Not zero, not an error. Gone.
7,831 of the month's 31,084 order lines were never counted.

The four euro countries are the easy half. The loss is total, 410 lines in
France, 1,739 in Germany, 229 in Italy, 665 in the Netherlands, so those
sections have no number to mislead anyone with. Online is the dangerous half. It
keeps 14,043 of its 18,831 lines and produces a figure that looks ordinary and
is a quarter too small. That is the one that gets pasted into a deck.

The explanation arrives in the moment the number would have been written down,
and nobody has to learn what `fx_rate_not_null` means. A hosted MCP server
could not do this. It would answer from the warehouse and never know what the
dashboard was about to claim.

Two things about that failure are constructed, and both are written down rather
than left to be discovered. The missing month of euro rates is deleted by
`etl/sql/01_bronze.sql`, because Contoso ships complete coverage and there is no
natural gap to point a tool at. And Contoso's amounts are already in US dollars,
so the pipeline assumes they are local currency in order to have a conversion
that can break at all. Everything downstream of those two lines is real: the
join really fails, `checks.py` really records it, and `npm run etl` reproduces
every count. `etl/README.md` and
[docs/adr/0003](docs/adr/0003-the-fx-gap-is-planted.md) say which line to
disagree with.

## How WebMCP is implemented

Tools live in `src/mcp/tools/`, registered from `src/mcp/register.ts`. All but
one are TypeScript. The last is declared in HTML and registered by the browser.

**Tools drive the page, they do not compose SQL.** A tool that moves the
dashboard calls the same store setter a click calls, so the human and the agent
share one state path and the page visibly moves when the agent acts. A tool
answering a question may read the same `/api/*` endpoint the page reads, which
the trust gate needs, because the dashboard cannot render a verdict for a slice
nobody asked for. Neither half touches DuckDB or writes SQL. A tool running its
own query would just be a badly hosted MCP server wearing a browser as a
costume.

**Capability scales through arguments, not registrations.** `breakdown_metric`
alone answers roughly forty questions, six metrics against eight dimensions,
from one registration. Forty named tools would answer the same questions and
make the agent worse at choosing between them.

**Registration follows page state.** The catalogue registers eight tools plus
the declarative form. Signing in swaps them for seven, so the count dips from
nine before it climbs. Opening the report adds two, and a failed check adds the
two diagnostic tools, topping out at eleven. Nothing is gated by identity. The
visible surface stays small while the answerable space stays large.

**A form with three attributes is a tool.** The catalogue search box carries
`toolname`, `tooldescription` and `toolautosubmit`, with `toolparamdescription`
on its fields, and Chrome 152 registers it as `search_catalog_form` with no
JavaScript. The browser synthesises the schema from the markup: `<select>`
options become an enum, `min` becomes `minimum`, `required` becomes the required
array. Calling it fills the real input, runs the page's own submit handler, and
answers through `SubmitEvent.respondWith`.

This is the strongest thing here, because the browser enforces the rule above
rather than a developer remembering it. There is no second code path, and the
schema cannot drift from the form because it is generated from it. It also
removes frontend work instead of adding it. An accessible form someone was
writing anyway becomes an agent capability for three attributes.

The limit is annotations, which are not expressible declaratively, so anything
needing `readOnlyHint` or `untrustedContentHint` stays imperative. That is why
`search_catalog_form` answers with a count and hands off to `search_products`
for the rows, since product copy is third-party text.

**Sequencing happens through return values, and decisions also come back as
data.** A tool's response is context the agent reads, so that is where the next
step gets steered. `check_data_trust` and `draft_report` append a JSON block
carrying the same answer as fields, because WebMCP validates tool input and
says nothing about output. See `src/mcp/structured.ts`.

A blocked section omits the figure key entirely rather than sending null or
zero. The dashboard renders Germany as `$0` for this period, so "we counted
zero" and "nothing was counted" must not serialise alike. Every answer also
carries `dataAsOf`, when the pipeline run finished, and `answeredAt`, when the
tool ran. A passing verdict over three-week-old data is still a verdict over
three-week-old data.

**`readOnlyHint` is claimed sparingly.** MCP defines it as "the tool does not
modify its environment". A tool that moves the page has modified its
environment, so only the few that answer without moving anything carry the hint.
Marking every read-oriented tool true would have been the flattering answer
rather than the correct one, and a judge who knows the spec will check.

Tools are registered only from our own modules, never from fetched content,
because runtime registration has a published attack surface.

## Two tool surfaces, one origin

Signed out, the origin is the Kestrel Supply Co. trade catalogue. Signing in
switches the shell to the internal dashboard and replaces the tools.

That switch is an argument no hosted MCP server can make. One origin serves two
tool surfaces decided by session, with the agent configuring nothing and holding
no credential, where a server would need two endpoints and two sets of
credentials.

It is not a security boundary and the code does not pretend otherwise.
Registration happens in the browser, so anyone with devtools can call the
internal setter. The boundary that matters is server side. `api/_lib/session.ts`
decides the depth of every answer and never refuses a question. Identity here is
depth, not access.

The switcher in the sidebar makes that visible. Ask `check_data_trust` about
Germany as Maya in Operations and the answer is "completeness" and a sentence.
Pick Tom on Data Platform from the same menu and the same tool, on the same
question, comes back with `fx_rate_not_null` and 1,739 of 1,739 order lines.
Nothing was refused in either case. Only the depth moved, and it moved because
`signIn` rewrote one cookie that the server reads.

The catalogue groups Contoso's 2,517 SKU rows into 885 product families, since
one SKU per colourway means a nine-colour camera is nine rows at one price.
Descriptions are composed field by field from the record, because Contoso ships
no description text and nothing should be presented as the supplier's words.
Artwork is generated locally, so no photograph stands in for a product it does
not depict. Filtering, paging and faceting happen on the server, and the
catalogue tools quote the same counts because they read the same endpoint.

## Architecture

```
OFFLINE

  Contoso V2  ──▶  Python + DuckDB  ──▶  data/gold/*.parquet
  orders · fx      bronze → silver → gold  data/meta/*.json
                                                  │
                                                  ▼
SERVER · Vercel serverless functions

  ┌─────────────────────────────────────────────────────┐
  │  Read-only API over DuckDB                          │
  │  one file per endpoint in api/                      │
  └─────────────────────────────────────────────────────┘
                          ▲
                          │   the same path a click takes
BROWSER

  ┌──────────────────┐        ┌───────────────────┐
  │   WebMCP tools   │ ─────▶ │  Catalogue · UI   │
  │  registered by   │        │  tiles · chart ·  │
  │   page context   │        │  report           │
  └──────────────────┘        └───────────────────┘
            ▲
            │
       The agent  ·  ChatGPT / Chrome
```

`shared/` holds the contract, the types and the metric registry, imported by the
server to build SQL and by the client to shape tool schemas. Defined once so it
cannot drift.

`/api/query` is the only endpoint that aggregates, and it composes every column
from that registry. Filter values bind as parameters, while metric and dimension
names are looked up in the registry and rejected if absent, so the only strings
reaching SQL text are ones this repository wrote. `/api/trust` reads the checks
the ETL recorded rather than recomputing them, because the rows that would prove
a completeness failure are the ones that are missing.

The pipeline is small but real. `trace_lineage` walks the chain from a dashboard
number back to the system it came from, and that chain has to point at something
true to be worth anything.

| Layer | Choice |
|---|---|
| Frontend | Vite, React 19, Tailwind, shadcn/ui, framework-agnostic store |
| Backend | Vercel serverless functions, DuckDB, read-only |
| Data | Contoso Data Generator V2, 1M-order tier, MIT |
| Charts | Recharts |
| Auth | Demo session. Identity, not security. No passwords |

## Running it

```bash
npm install
npm run dev          # the whole application on :5173
```

That is all of it. No second terminal, no Vercel login. In production `api/`
runs as Vercel serverless functions; locally `vite-api-plugin.ts` loads the same
handler modules through Vite. A second process is one more thing to break on
demo day. The committed gold parquet runs everything. To regenerate it, see
[etl/README.md](etl/README.md).

WebMCP needs a browser exposing `document.modelContext`: Chrome with the feature
on, or ChatGPT's in-app browser. Two probes measure it rather than trusting the
explainer, and every claim below came from them.

```bash
node docs/probe-modelcontext.mjs   # the browser API surface
node docs/probe-report-flow.mjs    # the report flow, driven as an agent
```

What they found. Unregistering means aborting the `AbortSignal` passed to
`registerTool`; there is no `unregisterTool`. `getTools()` returns `inputSchema`
as a string, and `executeTool` is a string on both sides, taking arguments as
JSON and resolving to JSON, so a caller reading `result.content` gets undefined
and an empty answer with no error. The explainer states neither.
`navigator.modelContext` is not a dead spelling, it is the same object.

A declarative tool's lifetime is its element's. Signing in unmounts the search
form and the browser drops `search_catalog_form` on its own, with no
`AbortController` and no code of ours. The browser also re-synthesises a
declarative schema after the markup changes, so a `<select>` filled by an async
fetch still ends up with a real enum.

## Repository

| | |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Working context: ownership, conventions, rules |
| [CONTEXT.md](CONTEXT.md) | Glossary. What our words mean |
| [docs/PLAN.md](docs/PLAN.md) | The reasoning, and where the build stands |
| [docs/open-questions.md](docs/open-questions.md) | What this build measured against the open spec questions |
| [docs/adr/](docs/adr/) | Decisions we do not want reversed by accident |

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
