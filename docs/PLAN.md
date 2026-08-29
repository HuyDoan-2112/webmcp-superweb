# The Number Was Never Real

**Build plan - OpenAI WebMCP Challenge**

> Product name: **SuperWeb**. The fictional company in the UI is **Kestrel Supply Co.**

| | |
|---|---|
| **Deadline** | Wed Sep 3, 2026 · 1:00pm PT |
| **Build day** | Fri Aug 28 - one day, both people |
| **Team** | 2 people |
| **Data** | Contoso Data Generator V2, 1M-order tier, MIT |
| **Demo period** | `2023-11`. Contoso orders run 2015-01-01 to 2024-04-20 |
| **Stack** | Vite + React 19 + Tailwind v4 + shadcn/ui · serverless API over DuckDB · static deploy |
| **Tools** | 13 WebMCP tools, registered by page context |

---

## 1. Thesis

Every week, someone who is not a data engineer looks at a dashboard, copies a number into a report or a deck, and sends it upward. Nobody checks whether the number was real. Checking would mean finding an analyst, filing a request, waiting - so they don't.

WebMCP closes that gap, because the agent operates the actual application: the same tool that drafts the report can see the pipeline behind the number. Rigour stops being a person you have to go ask and becomes a property of the tool you're already holding.

**The stakeholder never learns what `fx_rate_not_null` means.** They're told, in plain language, that one section can't be published - and what they can do instead.

The same thirteen tools serve everyone along the chain. A data scientist asks the grain, the exclusions, whether the month will backfill. An engineer asks which run produced it. Same machinery, different depth of answer.

---

## 2. Architecture

```
OFFLINE · your machine, run a few times on the build day
  Contoso V2  →  Python + DuckDB  →  data/gold/*.parquet
                 bronze→silver→gold   data/meta/*.json

SERVER · serverless functions, same Vercel project
  Read-only API over DuckDB
  /api/query · /api/trust · /api/lineage · /api/runs

BROWSER · what the user sees
  13 WebMCP tools  →  Dashboard UI  →  /api/*
         ↑
     The agent (ChatGPT / Chrome)
```

**A tool never queries data itself.** It drives the UI, and the UI calls the API - the same path a click takes. A tool running SQL directly would just be a badly-hosted MCP server, and WebMCP's purpose is reinforcing the frontend experience, not replacing the backend.

| Layer | Choice | Note |
|---|---|---|
| Frontend | Vite + React 19 + Tailwind v4 + shadcn/ui | Tools mutate the store; UI and agent share one state path |
| Backend | Serverless functions, DuckDB (node) | Read-only. Same project, no separate deploy |
| Data | Contoso gold parquet, server-side | No payload budget, no COOP/COEP, no WASM |
| Charts | Recharts | Trend line + grouped bar is the whole need |
| Deck | PptxGenJS, client-side | Produces a genuine `.pptx` in the browser |
| Auth | Demo session, no passwords | Identity, not security - see §6 |
| Repo | Public GitHub + MIT | Required by the rules |

The frontend was vanilla TypeScript in the first draft of this plan and is now
React. The swap was safe because it did not touch the property the demo rests
on. `src/store.ts` stayed framework-agnostic plain TypeScript with a
`subscribe()` function, and React reads it through `useSyncExternalStore` in
`src/hooks/use-store.ts`. Tools still mutate the store by calling its setters,
the UI still renders from the same state, and `src/mcp/` was not touched at all.

---

## 3. Folder structure

```
superweb/
│
├── shared/                     ★ both sides import this
│   ├── types.ts                  the contract: Metric, Row, TrustVerdict,
│   │                             LineageNode, User, Session, Audience,
│   │                             Surface, Product
│   └── metrics.ts                THE registry - one definition per metric,
│                                 plus DIMENSIONS and DEMO_PERIOD
│
├── etl/                        ← person A · offline, your laptop
│   ├── run.py                    orchestrates; writes meta/ on every run
│   ├── checks.py                 quality checks → meta/quality_checks.json
│   ├── sql/
│   │   ├── 01_bronze.sql         ← load, then plant the FX gap. See ADR 0003
│   │   ├── 02_silver.sql         ← the FX join lives here (and breaks here)
│   │   └── 03_gold.sql
│   └── README.md                 how to regenerate from scratch
│
├── data/                       ← ETL output, committed
│   ├── gold/
│   │   ├── fact_sales_daily.parquet
│   │   ├── fact_orders_daily.parquet
│   │   ├── dim_product.parquet
│   │   ├── dim_store.parquet
│   │   └── dim_date.parquet
│   └── meta/
│       ├── pipeline_runs.json
│       ├── quality_checks.json
│       └── lineage.json          stage-labelled chain
│
├── api/                        ← person A · Vercel serverless
│   ├── query.ts
│   ├── trust.ts
│   ├── lineage.ts
│   ├── runs.ts
│   └── _lib/
│       ├── duckdb.ts             connection + query helper
│       ├── compose.ts            registry → SQL
│       └── session.ts            who's asking → { userId, name, audience }
│
├── src/
│   ├── main.tsx                  boot: store → auth → UI → tools
│   ├── App.tsx                   surface switch: public catalogue or dashboard
│   ├── store.ts                  single source of UI state, plain TypeScript
│   ├── api.ts                    typed fetch wrappers
│   │
│   ├── auth/                   ← demo identity, not security
│   │   ├── session.ts            reads/writes the demo session cookie
│   │   ├── users.ts              3-4 seeded people at Kestrel Supply Co.
│   │   └── switcher.ts           the "signed in as…" control
│   │
│   ├── components/             ← person A · the shadcn/ui shell
│   │   ├── layout/               sidebar, header, period bar, theme toggle
│   │   └── ui/                   the shadcn primitives
│   ├── context/                  theme provider
│   ├── hooks/                    use-store.ts wraps useSyncExternalStore
│   ├── lib/                      cookies, class-name helper
│   ├── styles/                   Tailwind v4 entry and theme tokens
│   │
│   ├── mcp/                    ← person B · owns this folder entirely
│   │   ├── register.ts           document.modelContext adapter + context rules
│   │   ├── panel.ts              the visible "tools available" list
│   │   └── tools/
│   │       ├── read.ts           list_metrics, get_metric, breakdown_metric,
│   │       │                     compare_periods, find_drivers, describe_metric
│   │       ├── trust.ts          check_data_trust, explain_data_issue,
│   │       │                     trace_lineage
│   │       ├── view.ts           filter_dashboard
│   │       └── report.ts         start_report, draft_report, build_deck
│   │
│   └── ui/                     ← person A
│       ├── dashboard.tsx
│       ├── tiles.tsx
│       ├── chart.tsx
│       ├── breakdown.tsx
│       ├── report.tsx
│       ├── verdict.tsx
│       ├── lineage.tsx           the stage ladder
│       └── public/               the signed-out catalogue
│
├── index.html                    origin-trial <meta> goes here
├── vite.config.ts
├── vercel.json
├── LICENSE                       MIT - required
└── README.md                     architecture diagram - required
```

### Five rules about it

1. **`shared/` is the whole point.** The metric registry must be importable by the server (to build SQL) and the client (to shape tool `inputSchema` enums). Anywhere else and you maintain it twice, and it drifts by Sunday.

2. **Ownership maps to folders.** Person A owns `etl/`, `api/`, `src/ui/`, `src/auth/` and the React shell under `src/components/`, `src/context/`, `src/hooks/`, `src/lib/` and `src/styles/`. Person B owns `src/mcp/`. The only shared write surface is `shared/`, written together Friday morning and then treated as frozen - if it must change, say so out loud first.

3. **Watch the serverless bundle limit.** Committed parquet gets pulled into the function bundle, which is capped. Keep `data/gold/` under ~50 MB. If it grows, host the parquet as a static asset and read it over HTTP instead of bundling it.

4. **Register tools after the metric list loads.** `main.tsx` boots the store, restores the session, fetches the metric list, *then* calls `register.ts` - so tool schemas carry real metric names as enums rather than a free-text string the agent can typo. Your very first registration is then already dynamic.

5. **Both READMEs matter for judging.** The root one needs the architecture diagram (a requirement). `etl/README.md` is what makes a technical judge believe the pipeline is real rather than staged.

---

## 4. Tool surface

Chrome's guidance is explicit that each registered tool consumes context and that overlapping tools make selection worse. So capability scales through **arguments, not registrations**: `breakdown_metric` alone answers roughly forty questions - six metrics against eight dimensions - from one registration. Forty named tools would answer the same questions and make the agent worse at choosing among them.

Registration follows page state, the pattern the spec already uses for login and logout. Nothing is gated by identity; tools appear when they become **relevant**, keeping the visible surface at nine to thirteen while the answerable space stays large.

| Tool | Registered | What it does |
|---|---|---|
| `list_metrics` | always | Discovery - what can be asked, along which dimensions |
| `get_metric` | always | One KPI for a period, with its delta |
| `breakdown_metric` | always | Any metric × any dimension, ranked |
| `compare_periods` | always | Two periods, optionally split by a dimension |
| `find_drivers` | always | Which dimension explains most of a change - loops server-side, one call |
| `describe_metric` | always | Definition, **grain, filters applied, exclusions, definition version** |
| `check_data_trust` | always | Verdict for metric+period: checks, run status, freshness, **completeness** |
| `filter_dashboard` | always | Sets filters and period - moves what the human sees |
| `start_report` | always | Opens the report builder. Initiation, not execution |
| `draft_report` | report open | Writes sections into the report. Refuses untrusted numbers |
| `build_deck` | report open | Renders the report to a real `.pptx` |
| `trace_lineage` | after a failed check | The stage-labelled chain, upstream to the source that broke |
| `explain_data_issue` | after a failed check | The same fact, plain language, zero jargon |

**Sequencing happens through return values, not nesting.** A tool's response is context the agent reads, so it's where you steer what comes next:

```ts
return { content: [{ type: "text", text:
  "Drafted 5 of 6 sections. The Europe section is BLOCKED: all 3,043 " +
  "order lines behind net_revenue for this period lost their exchange " +
  "rate, so there is no figure to publish. Online is DEGRADED, a quarter " +
  "of its lines went the same way. Use explain_data_issue to tell the " +
  "user why, then publish without Europe or wait for a reload."
}]};
```

Mark every read-only tool `readOnlyHint: true`. Register only from your own modules, never from fetched content - runtime registration has a published attack surface, and one sentence about it in the writeup reads as real engineering maturity.

### The metric registry

```ts
// shared/metrics.ts - every tool and every endpoint reads from here
{
  id: "net_revenue",
  label: "Net Revenue",
  description: "What customers paid, after discounts, converted to US dollars.",
  unit: "currency",
  sql: "SUM(net_amount_usd)",
  grain: "gold.fact_sales_daily",
  dimensions: ["date","country","channel","category",
               "subcategory","brand","store","currency"],
  exclusions: [
    "Order lines whose currency had no exchange rate for the order date. " +
    "They are removed in silver rather than counted as zero."
  ],
  definitionVersion: "1.0.0",
  lineage: {
    upstream: ["bronze.orders","bronze.orderrows",
               "bronze.currencyexchange","silver.fct_order_lines"],
    transforms: [
      "join orders to orderrows on OrderKey",
      "net_amount = Quantity * NetPrice (the discount is already inside NetPrice)",
      "convert to USD via currencyexchange, matched on " +
      "FromCurrency = CurrencyCode, ToCurrency = 'USD', and the order date"
    ],
    owner: "data-platform",
    freshness: "daily 04:00 UTC"
  }
}
```

Three things in there are not what a first guess produces, and each was measured
against the source before it was written down.

- **There is no discount column.** `orderrows` carries `Quantity`, `UnitPrice`,
  `NetPrice` and `UnitCost`, and the discount already sits inside `NetPrice`.
  `Quantity * NetPrice` is the whole expression.
- **The rate direction is backwards from the obvious guess.** Contoso's own
  `sales.ExchangeRate` is USD to local, so converting *to* USD means joining on
  `FromCurrency = CurrencyCode, ToCurrency = 'USD'`. The reverse produces wrong
  numbers rather than an error.
- **Column names are PascalCase and the order date is `orders.DT`.** Not
  `OrderDate`, not snake_case. The gold tables the registry points at are ours
  and are snake_case; the bronze side is not.

Two grains, because `order_count` cannot live on the sales fact. One order spans
several products, so `gold.fact_orders_daily` exists alongside
`gold.fact_sales_daily` and carries a narrower dimension list. That is exactly
what `describe_metric` reports, and why the two cannot be compared silently.

**Channel is derived, not read.** No channel column exists anywhere in the eight
Contoso tables. The only honest proxy is the single online store,
`store.CountryCode = '--'`, against every physical store, and silver computes it
there so the registry can advertise the dimension without lying about where it
came from.

### The public surface

SuperWeb has two faces on one origin. Signed out, a visitor gets the Kestrel
product catalogue and their agent gets a small public tool set: browse, search,
open a product. Signing in switches the shell to the internal dashboard and
replaces the public tools with the full set above.

That switch is an argument no hosted MCP server can make. One origin serves two
different tool surfaces decided by session, where a server would need two
endpoints and two sets of credentials to do the same thing.

Be exact about what this is not. Tool registration happens in the browser, so
the split is **not a security boundary** - anyone with devtools open can call
the internal setter and register the internal tools. The real boundary is server
side, in `api/_lib/session.ts`, which decides the depth of every answer. That is
the same framing as §6: identity, not security. `/api/lineage` never refuses a
non-technical user, it answers in plain language instead of stage ladders, and
it answers an anonymous visitor at catalogue depth for the same reason.

---

## 5. The trust gate

`draft_report` is **not** an orchestrator. The agent has already gathered what it needs with the read tools; this commits it into the page - and checks each section before writing it.

```ts
draft_report({
  period: "2023-11",
  focus_metric: "net_revenue",
  sections: [{ heading, metric, dimension, commentary }, …]
})

// per section, server-side:
//   1. GET /api/query  → the numbers
//   2. GET /api/trust  → verdict for that metric + period + filter
//   3. verdict === "blocked" → render BLOCKED, never a number,
//      and say so in the return value
```

### The verdict has three values, not two

A verdict ranges over **metric + period + filter**, never metric + period alone.
The FX gap hits Europe; North America is sound. A verdict that could not see the
filter would block four good sections to protect one.

| Verdict | Meaning | Renders as |
|---|---|---|
| `ok` | Every check passed for this slice | The number |
| `degraded` | Something is off but the number stands | The number, with a noted gap |
| `blocked` | The number has not earned publication | BLOCKED, never a number |

### What the planted defect actually produces

Measured against the source for `2023-11`, with sections scoped by
`store.CountryCode`:

| Section | Order lines | Unmatched | Verdict |
|---|---|---|---|
| Europe - DE, FR, IT, NL stores | 3,043 | 3,043 · 100.00% | `blocked` |
| Online | 18,831 | 4,788 · 25.43% | `degraded` |
| United States | 5,743 | 0 · 0.00% | `ok` |
| Canada | 1,511 | 0 · 0.00% | `ok` |
| United Kingdom | 1,082 | 0 · 0.00% | `ok` |
| Australia | 874 | 0 · 0.00% | `ok` |

Month-wide that is 7,831 unmatched lines of 31,084, or 25.19%.

This is better than the plan originally asked for. Four sections publish, one
blocks, **and** one is genuinely degraded, so all three verdicts get exercised
by real data instead of `degraded` sitting frozen into the contract and never
rendering. Its rendering is no longer a decision to defer.

**Scope sections by `store.CountryCode`, not `customer.Continent`.** Continent
puts Great Britain in Europe, which mixes clean GBP revenue into the broken EUR
slice and turns a clean 100% block into an ambiguous 75%. It also collapses six
sections into three. The UK is its own section.

**Handle Online deliberately.** It is 18,831 of the month's 31,084 lines, so it
can neither be ignored nor blocked wholesale without killing the biggest number
on the page. Render it as the degraded section, which is the honest verdict and
the one that justifies the three-value contract, or drop it from the report's
section list and show it only on the dashboard. If it silently folds into a
country section the "four clean" claim stops being true.

That inversion is the project. The check doesn't live in a dashboard nobody reads, or an engineer's head, or a Slack thread three weeks later. It lives in the moment the number would have been written down.

---

## 6. Lineage and identity

### The chain is what the tool reveals

Operational systems → transformations → warehouse → curated tables → dashboard → report. You don't build a surface per stage; `trace_lineage` walks the chain backwards and labels each rung.

```
   net_revenue                    dashboard metric
 ↑ gold.fact_sales_daily          curated table
 ↑ silver.fct_order_lines         transformation  ← FAILED HERE
 ↑ bronze.currencyexchange        warehouse
 ↑ FX rate feed                   operational system
```

For the writeup: *"The same tool contract extends along the chain. An engineer asks which downstream KPIs break if a column changes; a scientist asks whether a month is final before training on it. We built the stakeholder end first, because that's where the trust failure surfaces - and where the person least equipped to catch it is standing."*

### Auth is identity, not security

**Do not build real authentication.** No passwords, no OAuth, no magic links. The rules make auth optional, and a login flow that breaks on September 3rd is a zero on Execution. A signed demo session that says *you are Maya, Ops* is enough to be truthful about everything you want to claim.

What it buys:

- **The agent acts in the user's session** - one of WebMCP's actual design rationales, currently undemonstrated.
- **The server decides the depth of the answer.** `/api/lineage` never *blocks* a non-technical user - that would contradict the whole thesis. It returns the same fact at the depth that fits who's asking: plain language for Maya in Ops, the full stage ladder and rejected-row counts for someone in data.
- **The report gets an author.** *"Prepared by Maya Okonkwo · Kestrel Supply Co."* in the `.pptx` footer. Tiny detail, disproportionate realism.
- **The anonymous visitor is a real audience, not a rejection.** `public` is a depth like the others. The catalogue answers at catalogue depth and never returns an error for not being signed in. See §4.

Keep both `explain_data_issue` and `trace_lineage` as separate tools - the agent should still be able to ask for the technical version explicitly. Identity adjusts the *default depth* of the response, not which tools exist.

---

## 7. The demo arc - three minutes

| Time | | |
|---|---|---|
| **0:00** | *"Draft me the November revenue report for the exec review."* | Period `2023-11`. `start_report` → panel opens → **tool count jumps 9 → 11 on screen** → `draft_report` |
| **0:40** | Five sections fill in. Europe comes back **blocked**, Online comes back **degraded**. | *"I can't publish Europe - every order line behind it is missing its exchange rate for this month. Online is short about a quarter of its lines for the same reason, so its total is understated."* **Tool count jumps again** as diagnostics register |
| **1:20** | *"What do you mean, missing?"* | `explain_data_issue` - plain language, no jargon. Publishes the other five with the Online gap flagged |
| **2:00** | *"Make it a deck."* | `build_deck` → a real `.pptx` lands in downloads, the blocked section carried as a flag rather than a number |
| **2:30** | Same question, technical depth | `trace_lineage` → the stage ladder, and 31,084 in · 23,253 out · **7,831 rejected** at the FX join |
| **2:45** | *"Nobody had to notice. That's the point."* | Open the video on the same line inverted |

**Opening line:** *Every week, someone pastes a dashboard number into a deck, and nobody checks whether it was real.*

---

## 8. The work, in dependency order

Not a schedule. The build is **one day, Fri Aug 28**, both people. What follows
is ordered by what blocks what, so anything whose blockers are done can be
picked up. The two of you alternate in practice, but nothing here requires you
to be at the keyboard at the same time.

### Gate 0 · PASSED, 2026-08-29

Two checks, twenty minutes each. Both ran and both passed, check 1 with a
correction to the API name and check 2 with a change to how the defect gets
made. Everything downstream assumes them.

- **Does `document.modelContext` respond?** Yes. A tool was registered, listed
  and executed end to end in Chrome 152. The API is on `document`, not
  `navigator`, and `navigator.modelContext` is `undefined` in that build.
- **Does Contoso carry non-USD orders with FX rate gaps?** Non-USD orders, yes,
  47.84% of them. Gaps, no. Coverage is a complete 25-pair by 3,653-day cross
  product with no holes, and all 2,098,633 order lines match. The defect is
  planted instead, in bronze, by deleting 30 rate rows. See §5 and ADR 0003.

One part of check 1 is still open. **No AI agent has invoked a registered tool
through a real agent turn yet.** The page-side half is settled - late
registration works, the tool appears in `getTools()` immediately, `toolchange`
fires - but whether an agent re-reads the tool list within one turn is
undocumented in the spec, and the event obliges nobody to act on it. The §9
fallback stays live: register the report tools when the panel opens via UI.

> **Gate:** a tool answered, and the FX story is buildable.

#### The API, as measured

Four members on an `EventTarget`: `registerTool`, `getTools`, `executeTool`, and
an `ontoolchange` event. There is no `provideContext` and no `unregisterTool` -
unregistration works by passing an `AbortSignal` to `registerTool` and aborting
it.

```js
const controller = new AbortController();

await document.modelContext.registerTool({
  name: "get_metric",
  title: "Get metric",                    // top level, NOT inside annotations
  description: "Read one metric for one period from the dashboard.",
  inputSchema: { type: "object", properties: { … }, required: [ … ] },
  annotations: { readOnlyHint: true },
  async execute({ metric, period }, { signal }) {
    // Drive the UI here. The UI calls /api/*. Never query data from the tool.
    return { content: [{ type: "text", text: "…" }] };
  }
}, { signal: controller.signal });        // controller.abort() unregisters
```

Five details the tool track will hit, all measured rather than assumed:

- **`title` is a top level field.** Nest it under `annotations` and the browser
  drops it silently, with no error and an empty `title` on read-back.
- **`annotations` normalizes to exactly `{readOnlyHint, untrustedContentHint}`.**
  Any other key is discarded.
- **`getTools()` returns `inputSchema` as a JSON string**, not the object that
  went in.
- **`executeTool` takes the tool record itself, not a name**, plus a JSON string
  of arguments, and returns a JSON string. Passing a name throws, and passing
  `{}` instead of `"{}"` throws.
- **The `execute` callback receives parsed arguments**, not a string. Only the
  outer `executeTool` boundary deals in JSON text.

#### The deployment caveat

The probe page carried no origin-trial token and worked anyway, which means this
Chrome has the feature switched on by flag. **A judge's browser will not.** The
origin trial still matters for the deployed URL, and the token binds to the
origin, so the Vercel URL has to be claimed before the `<meta http-equiv=
"origin-trial">` tag in `index.html` can be filled in. Claim the URL first, then
register, then never rename the project.

### Gate 1 · the contract

`shared/types.ts` and `shared/metrics.ts`, written **together**, then frozen.
Blocks everything on both tracks, so it happens first and it happens once.

`TrustVerdict` is `ok | degraded | blocked` over metric + period + filter. See §5.

> **Gate:** both tracks can start without asking each other a question.

### Then, two tracks

Ownership maps to folders and does not move. See §3 rule 2.

**Data track** owns `etl/`, `data/`, `api/`, `src/ui/`, `src/auth/` and the
React shell. Python, DuckDB, SQL and component work.

1. ETL bronze to silver to gold, plus `data/meta/*.json` written on every run
2. `/api/query` and `/api/trust` reading the registry
3. KPI tiles fed by the real API
4. Trend chart, breakdown table, filters
5. Report builder UI
6. `/api/lineage` and `/api/runs`, the stage ladder, demo session and switcher

**Tool track** owns `src/mcp/` entirely. Thirteen schemas and a tuning pass.
Whoever is more comfortable in TypeScript takes this half.

1. Registration layer and the `document.modelContext` adapter
2. The always-on read tools, in the rank order below
3. Tool-visibility panel
4. Context registration: tools appearing when the report opens and after a
   failed check
5. `draft_report` with the trust gate wired to `/api/trust`
6. Description tuning against real transcripts

### Tool rank

Build in this order. Everything from 9 down is **stretch**: written as an issue,
cut without ceremony if the day runs long. Nothing is removed from the plan, but
the ranking is what stops you building `find_drivers` at 2am while
`draft_report` is still broken.

| # | Tool | |
|---|---|---|
| 1 | `list_metrics` | core |
| 2 | `get_metric` | core |
| 3 | `breakdown_metric` | core |
| 4 | `describe_metric` | core |
| 5 | `check_data_trust` | core |
| 6 | `filter_dashboard` | core |
| 7 | `draft_report` | core, the demo |
| 8 | `explain_data_issue` | core, the demo |
| 9 | `trace_lineage` | stretch, pull back first |
| 10 | `start_report` | stretch |
| 11 | `compare_periods` | stretch |
| 12 | `build_deck` | stretch |
| 13 | `find_drivers` | stretch, cut first |

> **Gate:** the agent answers an unrehearsed question correctly, and a section
> gets blocked in plain language without anyone touching a switch.

### After the build day

The remaining days are not build days. Treat any code written in them as a
regression risk against a demo that already works.

- **Polish**: loading and empty states, error copy, keyboard focus. Clean
  machine, fresh browser profile, in-app browser check.
- **Record**: video under 3 minutes with audio. Record a backup take in case the
  live agent misbehaves on the day.
- **Submit**: README with architecture diagram, MIT licence, Devpost
  description covering use case, UX benefit and WebMCP implementation. Save the
  submission on Devpost rather than locally, and submit mid-morning on the 3rd,
  because Devpost slows in the final hour.

## 9. Risks

| | Risk | Response |
|---|---|---|
| ~~HIGH~~ | ~~**`navigator.modelContext` may not respond at all**~~ | **Retired at Gate 0.** `document.modelContext` responds and a full round trip completed in Chrome 152 |
| ~~HIGH~~ | ~~**The FX story needs non-USD orders in Contoso**~~ | **Retired at Gate 0.** Non-USD is 47.84% of orders. Coverage is complete, so the gap is planted rather than found. See ADR 0003 |
| **HIGH** | **Mid-turn tool registration is undocumented.** The spec doesn't say whether the agent sees newly registered tools in the same turn | Still open. Page-side is settled - `toolchange` fires and `getTools()` updates - but agent-side same-turn visibility is documented nowhere. If it fails, register the report tools when the panel opens via UI instead |
| **HIGH** | **Origin-trial token bound to the wrong origin.** The dev machine has the feature on by flag and hides this entirely | Claim the URL before the build day; never rename the project. Test in a browser with no flag set |
| **HIGH** | **One build day means no second attempt.** A track that stalls has no later day to absorb it | The tool rank in §8. Stop building down the list the moment the demo arc runs end to end |
| MED | **Wrong tool selection**, the most common way a WebMCP demo dies | Thirteen tools is enough for confusion. Descriptions are prompts: tune against real transcripts, not by reasoning about them |
| MED | **`.pptx` download blocked in the in-app browser** | `build_deck` is rank 12 and already stretch. Fallback: render in-page, offer the file in Chrome only |
| MED | **Serverless cold starts** make the agent look slow on the first call | Warm the function before recording; keep gold small enough to query well under a second |
| MED | **`shared/` drifts** because both tracks need it and it was frozen early | Changing it means saying so out loud first. It is the only shared write surface |

### If the day runs long, in order

The tool rank in §8 handles the tool half. This is everything else:

1. Identity switcher, hardcode one user and keep the session plumbing
2. Lineage ladder becomes a flat list
3. Store, brand and currency dimensions
4. Any chart past the trend line

Channel has moved off this list. It is the online store, the online store is
the degraded section, and the degraded section is a third of the demo.

---

## 10. Gate 0 checklist, and the licensing position

Answered 2026-08-29. Kept rather than deleted, because the record of what was
checked is worth more than a tidy list.

- [x] **Does Contoso carry a currency code on orders, with non-USD rows?** Yes. `orders.CurrencyCode`, five values, non-USD is 47.84% of orders.
- [x] **What date range does the 1M tier actually cover?** `orders.DT` runs 2015-01-01 to 2024-04-20. The tail thins first, so nothing after 2024-01 is usable. Demo period is `2023-11`.
- [x] **Confirm the real column names** in the Orders / OrderRows variant. PascalCase throughout, and the order date is `orders.DT`. `orderrows` carries `Quantity`, `UnitPrice`, `NetPrice`, `UnitCost` and no discount column. See §4 and `etl/README.md`.
- [ ] **Origin-trial token registered** against the final deploy URL. Still open, and the only one. See §8.

**On naming and licences.** Nothing is owed to anyone: the SQLBI data repo is MIT, free for any use including commercial. Contoso exists precisely to be the fictional company in demos, so using the name carries no risk - just don't use Microsoft logos or imply their involvement. Rename the company anyway, for product reasons: a UI that says "Contoso" reads as a tutorial built on sample data; one that says **Kestrel Supply Co.** reads as a product seeded with sample data.

All dependency licences clear for the "original work" requirement: Contoso data MIT, DuckDB MIT, PptxGenJS MIT, Recharts MIT, shadcn/ui MIT. The dashboard shell is adapted from `satnaing/shadcn-admin`, MIT, whose licence is retained verbatim at `vendor/shadcn-admin/LICENSE`.

---

## 11. Submission checklist

- [ ] Live URL working in ChatGPT's in-app browser **or** Chrome with WebMCP enabled
- [ ] Public repository with an open-source license
- [ ] Description: use-case fit, user-experience benefit, how WebMCP is implemented
- [ ] Video under 3 minutes, with audio, no third-party trademarks
- [ ] All materials in English
- [ ] Credentials supplied on the form if any auth is used
- [ ] Submitted before **Sep 3, 2026, 1:00pm PT**

**Judging - four equally weighted criteria.** *WebMCP Leverage* is carried by parameterized tools and context registration - depth of understanding, not tool count. *Execution* by the freeze date and by tools that answer unrehearsed questions. *Potential Impact* and *Creativity* both by the blocked section: a real problem, and a solution nobody demos.

One calibration: pitch this as what WebMCP **unlocks**, not what it was invented for. Its stated motivation is broader - letting sites expose capabilities so agents don't scrape the DOM. Claiming less makes the claim land harder with judges who know the spec.
