# SuperWeb

**Every internal dashboard needs a person to explain it. WebMCP lets it explain
itself.**

Every organisation has a surface like this: a dashboard, an internal portal, an
ops tool, holding numbers that came from half a dozen different departments.
The person reading it almost never owns the data in it. So when they need to
know what a number means, where it came from, or whether it can be trusted,
they ask someone. That person is busy. The answer takes a day, or a week, or it
never comes and the number gets used anyway.

## Your app is already the integration

Making an application agent-accessible usually means building a second one: an
MCP server, a parallel API, a set of tools reimplementing what the frontend
already does. SuperWeb does none of that. The dashboard exposes its own
capabilities as WebMCP tools, and the agent drives the real application through
the same path a click takes.

No backend to change. No service to host. The answers are also better, because
a tool that operates the actual product can see everything the product can see,
including whether a number deserves to be published at all.

This repository is one worked example, built for the OpenAI WebMCP Challenge.
The pattern is the point, and it transfers to any internal surface where the
data outnumbers the people who understand it.

---

## The demonstration

Ask the agent for a revenue report. It cuts the month into one section per
country the pipeline actually evaluated, publishes four, refuses four, and flags
one:

> I can't publish France, Germany, Italy or the Netherlands. Every order line
> behind them lost its exchange rate for this month, so there is no number to
> give you. Online is short about a quarter of its lines for the same reason, so
> that total is understated.

Nobody asked it to check. The business sells in five currencies, so every order
has to be converted to USD using the exchange rate for the day it was placed. A
month of euro rates is missing, so those orders silently fell out of the
pipeline. Not zero, not an error. Gone. 7,831 of the month's 31,084 order lines
were never counted.

The four euro countries are the easy half. The loss there is total - 410 lines
in France, 1,739 in Germany, 229 in Italy, 665 in the Netherlands, every one of
them rejected - so those sections have no number to mislead anyone with. Online
is the dangerous half: it keeps 14,043 of its 18,831 lines and produces a figure
that looks entirely ordinary and is a quarter too small. That is the one that
gets pasted into a deck.

The explanation arrives in the moment the number would have been written down,
and the person being protected never has to learn what `fx_rate_not_null`
means. A hosted MCP server could not do this: it would answer from the
warehouse and never know what the dashboard was about to claim.

## How WebMCP is implemented

The tools live in `src/mcp/tools/`, registered from `src/mcp/register.ts`. All
but one are written in TypeScript; the last is declared in HTML and registered
by the browser.

**Tools drive the page, they do not compose SQL.** A tool that moves the
dashboard calls the same store setter a click calls, so the human and the agent
share one state path and the page visibly moves when the agent acts. A tool
answering a question may read the same `/api/*` endpoint the page reads, which
is what the trust gate needs, because the dashboard cannot render a verdict for
a slice nobody asked for. Neither half touches DuckDB or writes SQL. `src/mcp/`
imports no database helper, and a tool that ran its own query would just be a
badly-hosted MCP server wearing a browser as a costume.

**Capability scales through arguments, not registrations.** `breakdown_metric`
alone answers roughly forty questions, six metrics against eight dimensions,
from a single registration. Forty named tools would answer the same questions
and make the agent worse at choosing between them.

**Registration follows page state.** The public catalogue registers five tools.
Signing in swaps them for seven. Opening the report registers two more, and a
check coming back failed registers the two diagnostic tools, so the surface tops
out at eleven and drops back as the page moves. Nothing is gated by identity.
The visible surface stays small while the answerable space stays large.

**A form with three attributes is a tool.** The catalogue search box carries
`toolname`, `tooldescription` and `toolautosubmit`, with `toolparamdescription`
on its two fields, and Chrome 152 registers it as `search_catalog_form` with no
JavaScript at all. The browser synthesises the JSON Schema from the markup. The
`<select>` options become an enum, `min` becomes `minimum`, and a `required`
attribute becomes the schema's required array. Calling the tool filled the real
input and the real select, ran the page's own submit handler, and returned
through `SubmitEvent.respondWith`.

This is the strongest thing in the repository, because it makes the rule above
something the browser enforces rather than something a developer has to keep
remembering. There is no second code path, and the schema cannot drift from the
form, because it is generated from it. It also removes frontend work rather than
adding it. An accessible form somebody was going to write anyway becomes an
agent capability for the price of three attributes.

The limit is annotations, which are not expressible declaratively, so anything
needing `readOnlyHint` or `untrustedContentHint` stays imperative. That is why
`search_catalog_form` answers with a count and hands off to `search_products`
for the rows. Product copy is third-party text and has to carry
`untrustedContentHint`.

**Schemas are built from the metric registry at runtime.** Tools register after
the metric list loads, so their arguments carry real metric names as enums
rather than free text the agent can typo.

**Sequencing happens through return values.** A tool's response is context the
agent reads, so that is where the next step gets steered. `draft_report` comes
back saying which section was blocked, why, and which tool explains it to the
user, rather than returning a status code and leaving the agent to guess.

**`readOnlyHint` is claimed sparingly.** The MCP schema defines it as "If true,
the tool does not modify its environment. Default: false." A tool that moves the
page has modified its environment, so only the few that answer without moving
anything carry the hint; every other tool calls a store setter and is marked
false. Marking all the read-oriented tools true would have been the flattering
answer rather than the correct one, and a judge who knows the spec will check.
`build_deck` is the one arguable case, since it reads the sections
`draft_report` already committed and mutates nothing, and it is left false
because it produces an artifact a person then hands around.

Tools are registered only from our own modules, never from fetched content,
because runtime registration has a published attack surface.

## The public surface

Signed out, the origin is the Kestrel Supply Co. trade catalogue, and the
visitor's agent gets five tools for browsing it plus the declarative search
form. Signing in switches the shell to the internal dashboard and replaces
those tools with the full set.

That switch is an argument no hosted MCP server can make. One origin serves two
different tool surfaces decided by session, with the agent configuring nothing
and holding no credential, where a server would need two endpoints and two sets
of credentials to do the same thing.

It is not a security boundary, and the code does not pretend otherwise.
Registration happens in the browser, so anyone with devtools open can call the
internal setter. The boundary that matters is server side: `api/_lib/session.ts`
decides the depth of every answer and never refuses a question. `/api/lineage`
answers a non-technical user in plain language instead of stage ladders, and
answers an anonymous visitor at catalogue depth. Identity here is depth, not
access.

That mechanism is server side and it works, but the UI cannot currently reach
it. Nothing writes the `superweb_session` cookie, so every request arrives
anonymous and every answer comes back at catalogue depth. The varying depths are
reachable by sending the cookie by hand. See docs/PLAN.md section 9.

### What the catalogue does

**885 products, not 2,517 rows.** Contoso ships one SKU per colourway, so a
nine-colour camera is nine rows at one identical price. `/api/products` groups
on `family_key` and the visitor sees 885 lines, each with its row of colour
swatches. Only 27 families carry more than one distinct price, which is why a
family reports a price range rather than a number.

**Descriptions are composed field by field from the catalogue record.** Contoso
ships no description text at all, so every sentence is assembled from the fields
that do exist. Nothing is invented and no sentence is presented as the
supplier's own words. The detail page prints the note saying so.

**Product artwork is generated locally.** No network request, no external
licence, and no photograph standing in for a product it does not depict. The
tint comes from the colourway on show, so picking another swatch changes the
picture.

**Filtering, paging, faceting and counting happen on the server.** Each facet is
counted with every filter applied except its own, so a count never promises a
page that turns out empty once you click it. The catalogue tools quote the same
counts because they read the same endpoint.

**Five interface languages.** Only the interface is translated. Product names,
brands, categories and colours are shown exactly as the supplier records them,
because a buyer searching for "Fabrikam Independent Filmmaker" needs to find it
under that name in every language.

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

`shared/` holds the contract: the types and the metric registry, imported by
both the server (to build SQL) and the client (to shape tool schemas). It is
defined once so it cannot drift.

`/api/query` is the only endpoint that aggregates, and it composes every column
and every expression from that registry. Filter values are bound as parameters,
while metric and dimension names are looked up in the registry and rejected if
absent, so the only strings that reach the SQL text are ones this repository
wrote. `/api/trust` reads the checks the ETL recorded rather than recomputing
them, because the rows that would prove a completeness failure are the ones that
are missing.

The pipeline is deliberately small but real. `trace_lineage` walks the chain
from a dashboard number back to the operational system it came from, and that
chain has to point at something true to be worth anything.

| Layer | Choice |
|---|---|
| Frontend | Vite + React 19 + Tailwind + shadcn/ui, framework-agnostic store |
| Backend | Vercel serverless functions, DuckDB, read-only |
| Data | Contoso Data Generator V2, 1M-order tier (MIT) |
| Charts | Recharts |
| Auth | Demo session. Identity, not security. No passwords |

## Running it

```bash
npm install
npm run dev          # the whole application on :5173
```

That is all of it. No second terminal, no Vercel login. In production `api/`
runs as Vercel serverless functions; locally `vite-api-plugin.ts` loads the same
handler modules through Vite and serves them in process. A second process is one
more thing to be broken on demo day.

The committed gold parquet is enough to run everything. To regenerate it from
the Contoso source, see [etl/README.md](etl/README.md).

WebMCP requires a browser that exposes `document.modelContext`: Chrome with the
feature enabled, or ChatGPT's in-app browser. The interface is `registerTool`,
`getTools` and `executeTool` on an event target that fires `toolchange`;
unregistering means aborting the `AbortSignal` passed to `registerTool`.
Measured on 2026-08-29. `navigator.modelContext` is not a dead spelling: it is
the same object, and `document.modelContext === navigator.modelContext` returns
true. `adapter.ts` reads `document` first regardless, so either spelling works.

A declarative tool's lifetime is its element's. Signing in unmounts the
catalogue search form and the browser drops `search_catalog_form` from
`getTools()` on its own, with no `AbortController` and no code of ours. Measured
across the surface switch: six tools before, seven after, the form gone. The
imperative groups need a controller each; the declarative one needs nothing,
which is the same argument as the schema, one layer down.

## Repository

| | |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Working context: ownership, conventions, rules |
| [CONTEXT.md](CONTEXT.md) | Glossary. What our words mean |
| [docs/PLAN.md](docs/PLAN.md) | The reasoning, and where the build stands |
| [docs/adr/](docs/adr/) | Decisions we do not want reversed by accident |

## Licence

MIT, see [LICENSE](LICENSE). Every dependency is permissively licensed: the
Contoso Data Generator data is MIT, DuckDB MIT, Recharts MIT, shadcn/ui MIT.

The dashboard shell (layout, theme tokens and the shadcn/ui component set) is
adapted from [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin),
MIT, Copyright (c) 2024 Sat Naing. Its licence is retained verbatim at
[vendor/shadcn-admin/LICENSE](vendor/shadcn-admin/LICENSE).

The sample data is Microsoft's Contoso dataset, published to be used this way.
Nothing is owed to anyone for it, and Contoso exists precisely to be the
fictional company in demos. The company is renamed to Kestrel Supply Co. for
product reasons rather than legal ones: a UI that says "Contoso" reads as a
tutorial built on sample data, and one that says Kestrel reads as a product
seeded with it. No Microsoft logo appears and no involvement is implied. The
business it describes is not real.
