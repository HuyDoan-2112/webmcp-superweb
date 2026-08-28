# SuperWeb

**Every internal dashboard needs a person to explain it. WebMCP lets it explain
itself.**

Every organisation has a surface like this: a dashboard, an internal portal, an
ops tool, holding numbers that came from half a dozen different departments.
The person reading it almost never owns the data in it. So when they need to
know what a number means, where it came from, or whether it can be trusted,
they ask someone. That person is busy. The answer takes a day, or a week, or it
never comes and the number gets used anyway.

WebMCP closes that gap, because an agent can operate the application directly.
The question gets answered in seconds, by the application itself, at the moment
it is asked.

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

Ask the agent for a revenue report. It writes four sections and refuses the
fifth:

> I can't publish the Europe numbers. The data behind them is incomplete for
> this period, so the 38% decline isn't real.

Nobody asked it to check. The business sells in several currencies, so every
order has to be converted to USD using the exchange rate for the day it was
placed. Some rate rows are missing, so those orders silently fell out of the
pipeline. Not zero, not an error. Gone. Europe did not decline 38%; 121,513
order lines were never counted.

Finding that out the old way means knowing an analyst exists, knowing to
suspect the number, asking, and waiting. Here the explanation arrives in the
moment the number would have been written down, and the person being protected
never has to learn what `fx_rate_not_null` means.

A hosted MCP server could not do this. It would answer from the warehouse and
never know what the dashboard was about to claim.

## How WebMCP is implemented

**Tools never query data.** A tool drives the UI, and the UI calls the API.
Same path a click takes. A tool running SQL directly would just be a
badly-hosted MCP server sitting in a browser tab.

**Capability scales through arguments, not registrations.** `breakdown_metric`
alone answers roughly forty questions, six metrics against seven dimensions,
from a single registration. Forty named tools would answer the same questions
and make the agent worse at choosing between them.

**Registration follows page state.** Tools appear when they become relevant:
the report tools when the report opens, the diagnostic tools after a check
fails. Nothing is gated by identity. The visible surface stays small while the
answerable space stays large.

**Schemas are built from the metric registry at runtime.** Tools register after
the metric list loads, so their arguments carry real metric names as enums
rather than free text the agent can typo.

**Sequencing happens through return values.** A tool's response is context the
agent reads, so that is where the next step gets steered:

```
Drafted 4 of 5 sections. The Europe section is BLOCKED: the data behind
net_revenue for this period failed a completeness check, so the 38% decline
is not trustworthy. Use explain_data_issue to tell the user why, then publish
without it or wait for a reload.
```

Every read-only tool is marked `readOnlyHint: true`. Tools are registered only
from our own modules, never from fetched content, because runtime registration
has a published attack surface.

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
  │  /api/query · /api/trust · /api/lineage · /api/runs  │
  └─────────────────────────────────────────────────────┘
                          ▲
                          │   the same path a click takes
BROWSER

  ┌──────────────────┐        ┌───────────────────┐
  │   WebMCP tools   │ ─────▶ │  Dashboard UI     │
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

The pipeline is deliberately small but real. `trace_lineage` walks the chain
from a dashboard number back to the operational system it came from, and that
chain has to point at something true to be worth anything.

| Layer | Choice |
|---|---|
| Frontend | Vite + vanilla TS, small central store |
| Backend | Vercel serverless functions, DuckDB, read-only |
| Data | Contoso Data Generator V2, 1M-order tier (MIT) |
| Charts | Observable Plot |
| Auth | Demo session. Identity, not security. No passwords |

## Running it

```bash
npm install
npm run dev          # dashboard on :5173
```

The API runs as Vercel functions. In a second terminal:

```bash
npx vercel dev       # serves api/ on :3000
```

The committed gold parquet is enough to run the dashboard. To regenerate it
from the Contoso source, see [etl/README.md](etl/README.md).

WebMCP requires a browser that exposes `navigator.modelContext`: Chrome with
the feature enabled, or ChatGPT's in-app browser.

## Repository

| | |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Working context: ownership, conventions, rules |
| [CONTEXT.md](CONTEXT.md) | Glossary. What our words mean |
| [docs/PLAN.md](docs/PLAN.md) | The build plan |
| [docs/adr/](docs/adr/) | Decisions we do not want reversed by accident |

## Licence

MIT, see [LICENSE](LICENSE). Contoso Data Generator data is MIT, DuckDB MIT,
PptxGenJS MIT, Observable Plot ISC. The sample data is Microsoft's Contoso
dataset, published to be used this way. The business it describes is not real.
