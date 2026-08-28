# The Number Was Never Real

**Build plan - OpenAI WebMCP Challenge**

> Product name: **SuperWeb**. The fictional company in the UI is **Kestrel Supply Co.**

| | |
|---|---|
| **Deadline** | Wed Sep 3, 2026 · 1:00pm PT |
| **Build day** | Fri Aug 28 - one day, both people |
| **Team** | 2 people |
| **Data** | Contoso Data Generator V2, 1M-order tier, MIT |
| **Stack** | Vite + vanilla TS · serverless API over DuckDB · static deploy |
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
| Frontend | Vite + vanilla TS, ~50-line store | Tools mutate the store; UI and agent share one state path |
| Backend | Serverless functions, DuckDB (node) | Read-only. Same project, no separate deploy |
| Data | Contoso gold parquet, server-side | No payload budget, no COOP/COEP, no WASM |
| Charts | Observable Plot | Trend line + grouped bar is the whole need |
| Deck | PptxGenJS, client-side | Produces a genuine `.pptx` in the browser |
| Auth | Demo session, no passwords | Identity, not security - see §6 |
| Repo | Public GitHub + MIT | Required by the rules |

---

## 3. Folder structure

```
superweb/
│
├── shared/                     ★ both sides import this
│   ├── types.ts                  the contract: Metric, Row, TrustVerdict,
│   │                             LineageNode, User, Audience
│   └── metrics.ts                THE registry - one definition per KPI
│
├── etl/                        ← person A · offline, your laptop
│   ├── run.py                    orchestrates; writes meta/ on every run
│   ├── checks.py                 quality checks → meta/quality_checks.json
│   ├── sql/
│   │   ├── 01_bronze.sql
│   │   ├── 02_silver.sql         ← the FX join lives here (and breaks here)
│   │   └── 03_gold.sql
│   └── README.md                 how to regenerate from scratch
│
├── data/                       ← ETL output, committed
│   ├── gold/
│   │   ├── fact_sales_daily.parquet
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
│   ├── main.ts                   boot: store → auth → UI → tools
│   ├── store.ts                  ~50 lines, single source of UI state
│   ├── api.ts                    typed fetch wrappers
│   │
│   ├── auth/                   ← demo identity, not security
│   │   ├── session.ts            reads/writes the demo session cookie
│   │   ├── users.ts              3–4 seeded people at Kestrel Supply Co.
│   │   └── switcher.ts           the "signed in as…" control
│   │
│   ├── mcp/                    ← person B · owns this folder entirely
│   │   ├── register.ts           modelContext adapter + context rules
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
│       ├── dashboard.ts
│       ├── tiles.ts
│       ├── chart.ts
│       ├── breakdown.ts
│       ├── report.ts
│       └── lineage.ts            the stage ladder
│
├── index.html                    origin-trial <meta> goes here
├── vite.config.ts
├── vercel.json
├── LICENSE                       MIT - required
└── README.md                     architecture diagram - required
```

### Five rules about it

1. **`shared/` is the whole point.** The metric registry must be importable by the server (to build SQL) and the client (to shape tool `inputSchema` enums). Anywhere else and you maintain it twice, and it drifts by Sunday.

2. **Ownership maps to folders.** Person A owns `etl/`, `api/`, `src/ui/`. Person B owns `src/mcp/`. The only shared write surface is `shared/`, written together Friday morning and then treated as frozen - if it must change, say so out loud first.

3. **Watch the serverless bundle limit.** Committed parquet gets pulled into the function bundle, which is capped. Keep `data/gold/` under ~50 MB. If it grows, host the parquet as a static asset and read it over HTTP instead of bundling it.

4. **Register tools after the metric list loads.** `main.ts` boots the store, restores the session, fetches the metric list, *then* calls `register.ts` - so tool schemas carry real metric names as enums rather than a free-text string the agent can typo. Your very first registration is then already dynamic.

5. **Both READMEs matter for judging.** The root one needs the architecture diagram (a requirement). `etl/README.md` is what makes a technical judge believe the pipeline is real rather than staged.

---

## 4. Tool surface

Chrome's guidance is explicit that each registered tool consumes context and that overlapping tools make selection worse. So capability scales through **arguments, not registrations**: `breakdown_metric` alone answers roughly forty questions - six metrics against seven dimensions - from one registration. Forty named tools would answer the same questions and make the agent worse at choosing among them.

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
  "Drafted 4 of 5 sections. The Europe section is BLOCKED: the data " +
  "behind net_revenue for this period failed a completeness check, so " +
  "the 38% decline is not trustworthy. Use explain_data_issue to tell " +
  "the user why, then publish without it or wait for a reload."
}]};
```

Mark every read-only tool `readOnlyHint: true`. Register only from your own modules, never from fetched content - runtime registration has a published attack surface, and one sentence about it in the writeup reads as real engineering maturity.

### The metric registry

```ts
// shared/metrics.ts - every tool and every endpoint reads from here
{
  id: "net_revenue",
  label: "Net Revenue",
  description: "Gross sales less returns and discounts, converted to USD.",
  unit: "currency",
  sql: "SUM(net_amount_usd)",
  grain: "gold.fact_sales_daily",
  dimensions: ["date","category","subcategory","store","country","channel"],
  lineage: {
    upstream: ["bronze.orders","bronze.orderrows",
               "bronze.currencyexchange","silver.fct_order_lines"],
    transforms: [
      "join orders → orderrows on order_id",
      "net_amount = quantity * unit_price * (1 - discount)",
      "convert to USD via currencyexchange (rate lookup by date+currency)"
    ],
    owner: "data-platform",
    freshness: "daily 04:00 UTC"
  }
}
```

---

## 5. The trust gate

`draft_report` is **not** an orchestrator. The agent has already gathered what it needs with the read tools; this commits it into the page - and checks each section before writing it.

```ts
draft_report({
  period: "2024-11",
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
filter would block four good sections to protect one, and the demo is four
published and one blocked.

| Verdict | Meaning | Renders as |
|---|---|---|
| `ok` | Every check passed for this slice | The number |
| `degraded` | Something is off but the number stands | The number, with a noted gap |
| `blocked` | The number has not earned publication | BLOCKED, never a number |

`degraded` is frozen into the contract now and its rendering is decided later,
once there is a page to look at. Three values cost nothing if only two get used;
widening from two would touch every tool, the API and the renderer.

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

Keep both `explain_data_issue` and `trace_lineage` as separate tools - the agent should still be able to ask for the technical version explicitly. Identity adjusts the *default depth* of the response, not which tools exist.

---

## 7. The demo arc - three minutes

| Time | | |
|---|---|---|
| **0:00** | *"Draft me a revenue report for the exec review."* | `start_report` → panel opens → **tool count jumps 9 → 11 on screen** → `draft_report` |
| **0:40** | Four sections fill in. The fifth comes back **blocked**. | *"I can't publish the Europe numbers - the data behind them is incomplete for this period, so the 38% decline isn't real."* **Tool count jumps again** as diagnostics register |
| **1:20** | *"What do you mean, incomplete?"* | `explain_data_issue` - plain language, no jargon. Publishes the other four with the gap flagged |
| **2:00** | *"Make it a deck."* | `build_deck` → a real `.pptx` lands in downloads, the blocked section carried as a flag rather than a number |
| **2:30** | Same question, technical depth | `trace_lineage` → the stage ladder, and 4,182,901 in · 4,061,388 out · **121,513 rejected** at the FX join |
| **2:45** | *"Nobody had to notice. That's the point."* | Open the video on the same line inverted |

**Opening line:** *Every week, someone pastes a dashboard number into a deck, and nobody checks whether it was real.*

---

## 8. The work, in dependency order

Not a schedule. The build is **one day, Fri Aug 28**, both people. What follows
is ordered by what blocks what, so anything whose blockers are done can be
picked up. The two of you alternate in practice, but nothing here requires you
to be at the keyboard at the same time.

### Gate 0 · before any code is written

Two checks, twenty minutes each. Everything downstream assumes both passed, and
both are cheap to run and expensive to discover late.

- **Does `navigator.modelContext` respond?** One static HTML page, one hardcoded
  tool, one agent turn. If this fails, the project is not buildable in its
  current shape and you need the morning to find out, not the evening.
- **Does Contoso carry non-USD orders with FX rate gaps?** The demo defect has
  no home without it. If the 1M tier is single-currency, move the failure to the
  store or product dimension join. Same story shape, same tool surface.

> **Gate:** you have seen a tool answer, and you know the FX story is buildable.

### Gate 1 · the contract

`shared/types.ts` and `shared/metrics.ts`, written **together**, then frozen.
Blocks everything on both tracks, so it happens first and it happens once.

`TrustVerdict` is `ok | degraded | blocked` over metric + period + filter. See §5.

> **Gate:** both tracks can start without asking each other a question.

### Then, two tracks

Ownership maps to folders and does not move. See §3 rule 2.

**Data track** owns `etl/`, `data/`, `api/`, `src/ui/`, `src/auth/`.
Python, DuckDB, SQL and DOM work.

1. ETL bronze to silver to gold, plus `data/meta/*.json` written on every run
2. `/api/query` and `/api/trust` reading the registry
3. KPI tiles fed by the real API
4. Trend chart, breakdown table, filters
5. Report builder UI
6. `/api/lineage` and `/api/runs`, the stage ladder, demo session and switcher

**Tool track** owns `src/mcp/` entirely. Thirteen schemas and a tuning pass.
Whoever is more comfortable in TypeScript takes this half.

1. Registration layer and the `modelContext` adapter
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
| **HIGH** | **`navigator.modelContext` may not respond at all** in the browser you have. Nothing else in this plan survives it | Gate 0. Twenty minutes, before any code. One static page, one hardcoded tool |
| **HIGH** | **The FX story needs non-USD orders in Contoso.** If the 1M tier is single-currency the demo defect has no home | Gate 0. Fallback: move the failure to the store or product dimension join, same story shape |
| **HIGH** | **Mid-turn tool registration is undocumented.** The spec doesn't say whether the agent sees newly registered tools in the same turn | Test it during Gate 0 while the static page is already open. If it fails, register the report tools when the panel opens via UI instead |
| **HIGH** | **Origin-trial token bound to the wrong origin** | Claim the URL before the build day; never rename the project |
| **HIGH** | **One build day means no second attempt.** A track that stalls has no later day to absorb it | The tool rank in §8. Stop building down the list the moment the demo arc runs end to end |
| MED | **Wrong tool selection**, the most common way a WebMCP demo dies | Thirteen tools is enough for confusion. Descriptions are prompts: tune against real transcripts, not by reasoning about them |
| MED | **`.pptx` download blocked in the in-app browser** | `build_deck` is rank 12 and already stretch. Fallback: render in-page, offer the file in Chrome only |
| MED | **Serverless cold starts** make the agent look slow on the first call | Warm the function before recording; keep gold small enough to query well under a second |
| MED | **`shared/` drifts** because both tracks need it and it was frozen early | Changing it means saying so out loud first. It is the only shared write surface |

### If the day runs long, in order

The tool rank in §8 handles the tool half. This is everything else:

1. Identity switcher, hardcode one user and keep the session plumbing
2. Lineage ladder becomes a flat list
3. Store and channel dimensions
4. Any chart past the trend line

---

## 10. Gate 0 checklist, and the licensing position

- [ ] **Does Contoso carry a currency code on orders, with non-USD rows?** The entire demo defect hangs on this. If not, plant the failure at the store or product dimension join instead.
- [ ] **What date range does the 1M tier actually cover?** Undocumented in the release. It decides your demo month and every period comparison.
- [ ] **Confirm the real column names** in the Orders / OrderRows variant before `shared/types.ts` is written on Friday.
- [ ] **Origin-trial token registered** against the final deploy URL.

**On naming and licences.** Nothing is owed to anyone: the SQLBI data repo is MIT, free for any use including commercial. Contoso exists precisely to be the fictional company in demos, so using the name carries no risk - just don't use Microsoft logos or imply their involvement. Rename the company anyway, for product reasons: a UI that says "Contoso" reads as a tutorial built on sample data; one that says **Kestrel Supply Co.** reads as a product seeded with sample data.

All dependency licences clear for the "original work" requirement: Contoso data MIT, DuckDB MIT, PptxGenJS MIT, Observable Plot ISC.

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
