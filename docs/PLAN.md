# The number was never real

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

This document holds the reasoning: why a thing is the way it is, what was
rejected, and where the build stands. It does not restate what the code says.
Counts, file layouts and endpoint lists are read from the repository, because a
document that repeats them is a staleness bug waiting to be written.

Most of what follows is why a decision was made, not what to do next; CLAUDE.md
holds the binding rules, `src/mcp/README.md` holds the tool recipe, and
`docs/adr/` holds the decisions that outlived the day they were made. Read this
file for that reasoning, not before a routine change.

The section numbers below are load-bearing: `api/_lib/session.ts`,
`src/main.tsx`, `src/mcp/tools/report.ts`, and `src/mcp/README.md` cite
specific sections by number in code comments this document cannot touch, so
the numbering stays fixed even where content moves. That is also why §10 does
not exist: a section was cut after those comments were written, and
renumbering everything after it would break every one of those references.

---

## 0. Where the build stands

Written 2026-08-29, corrected 2026-08-31. This section is the first thing to
update when something changes, because a plan that reads as a plan after the
application exists is worse than no plan.

**Done.** Gate 0, both checks. The shared contract in `shared/`. The ETL, bronze
to silver to gold, with the gold parquet and the run metadata committed. The
read-only API over DuckDB in `api/`. Both surfaces built and pointed at real
endpoints, the public catalogue and the dashboard alike. The tool layer in
`src/mcp/`, imperative tools plus the declarative search form, with the
visibility panel and the context registration rules. The origin trial token in
`index.html`, bound to `https://webmcp-superweb.vercel.app`, expiring
2026-11-17. The working tree is clean. **Deployed.** The origin above serves
the built app, and `/api/query` and `/api/trust` return real numbers off the
committed gold parquet, confirmed 2026-08-31. Vercel does bundle the DuckDB
native binary into the serverless function without issue.

**Not done.** These are what is left before the deadline, in the order they will
hurt.

- **No AI agent has chosen and invoked a tool on its own.** Every tool has been
  driven from the console. §8's gate says the agent answers an unrehearsed
  question, and console calls do not satisfy that wording. This is the one that
  decides whether the demo exists.
- **`build_deck` returns a slide outline, not a `.pptx`.** PptxGenJS is not
  installed, confirmed 2026-08-31. The fallback in §9 was always to render in
  the page, and that is what it does.
- **The report author is hardcoded.** *"Prepared by Maya Okonkwo"* is text in
  `src/ui/report.tsx`, not a read off the session, confirmed 2026-08-31. See §6.

---

## 1. Thesis

Every week, someone who is not a data engineer looks at a dashboard, copies a number into a report or a deck, and sends it upward. Nobody checks whether the number was real. Checking would mean finding an analyst, filing a request, waiting - so they don't.

WebMCP closes that gap, because the agent operates the actual application: the same tool that drafts the report can see the pipeline behind the number. Rigour stops being a person you have to go ask and becomes a property of the tool you're already holding.

**The stakeholder never learns what `fx_rate_not_null` means.** They're told, in plain language, that one section can't be published - and what they can do instead.

The same tools serve everyone along the chain. A data scientist asks the grain, the exclusions, whether the month will backfill. An engineer asks which run produced it. Same machinery, different depth of answer.

---

## 2. Architecture

```
OFFLINE · your machine, run a few times on the build day
  Contoso V2  →  Python + DuckDB  →  data/gold/*.parquet
                 bronze→silver→gold   data/meta/*.json

SERVER · serverless functions, same Vercel project
  Read-only API over DuckDB, one file per endpoint in api/

BROWSER · what the user sees
  WebMCP tools  →  Catalogue / Dashboard UI  →  /api/*
         ↑
     The agent (ChatGPT / Chrome)
```

**A tool never queries data itself.** It drives the UI, and the UI calls the API, the same path a click takes. CLAUDE.md states the rule; the reasoning is that WebMCP's purpose is reinforcing the frontend experience, not replacing the backend.

As built, the line has two halves and `src/mcp/api.ts` says so at the top. A tool that *moves the page* goes through the store, never around it, so the human and the agent share one state path. A tool *answering a question* may read the same `/api/*` endpoint the page read, which the trust gate in §5 requires, because the dashboard cannot render a verdict for a slice nobody asked for. Neither half touches DuckDB or composes SQL, and `src/mcp/` imports no database helper. That is the thing the rule was written to prevent.

| Layer | Choice | Note |
|---|---|---|
| Frontend | Vite + React 19 + Tailwind v4 + shadcn/ui | Tools mutate the store; UI and agent share one state path |
| Backend | Serverless functions, DuckDB (node) | Read-only. Same project, no separate deploy |
| Data | Contoso gold parquet, server-side | No payload budget, no COOP/COEP, no WASM |
| Charts | Recharts | Trend line + grouped bar is the whole need |
| Deck | Slide outline, in the page | PptxGenJS is not installed. See §0 and §9 |
| Auth | Demo session, no passwords | Identity, not security - see §6 |
| Repo | Public GitHub + MIT | Required by the rules |

The frontend was vanilla TypeScript in the first draft of this plan and is now
React. The swap was safe because it did not touch the property the demo rests
on: `src/store.ts` stayed framework-agnostic plain TypeScript with a
`subscribe()` function, and React reads it through `useSyncExternalStore`. Tools
still mutate the store by calling its setters, the UI still renders from the
same state, and `src/mcp/` was not touched at all.

---

## 3. Structure and ownership

`ls` answers what is where. Five rules answer why.

1. **`shared/` is the whole point.** The metric registry must be importable by the server (to build SQL) and the client (to shape tool `inputSchema` enums). Anywhere else and you maintain it twice, and it drifts by Sunday.

2. **Ownership maps to folders**, exactly as CLAUDE.md's table states. The only shared write surface is `shared/`, written together Friday morning and then treated as frozen - if it must change, say so out loud first.

3. **Watch the serverless bundle limit.** Committed parquet gets pulled into the function bundle, which is capped. Keep `data/gold/` under ~50 MB. If it grows, host the parquet as a static asset and read it over HTTP instead of bundling it.

4. **Register tools after the metric list loads.** The metric registry (`shared/metrics.ts`) is a static import, resolved before `main.tsx` starts the tool layer, so tool schemas carry real metric names as enums rather than a free-text string the agent can typo. Your very first registration is then already dynamic.

5. **Both READMEs matter for judging.** The root one needs the architecture diagram (a requirement). `etl/README.md` is what makes a technical judge believe the pipeline is real rather than staged.

### The API layer

The endpoints are the files in `api/`, one apiece, all read-only, all answering
at the depth `api/_lib/session.ts` decides and none of them refusing a question.
Three properties of the layer are not visible from that file listing.

**`/api/query` is the only one that aggregates**, and it composes every column
and every expression from `shared/metrics.ts` through `_lib/compose.ts`. Nothing
in that file hardcodes a metric, which is the property that stops the server and
the tool schemas drifting apart.

**Filter values are bound as parameters; names are not interpolated.** Metric and
dimension names are looked up in the registry and rejected if absent, so the only
strings that reach the SQL text are ones this repository wrote. A metric that
cannot be split along a dimension says so with the grain in the sentence rather
than returning an empty result.

**`/api/trust` reads the checks the ETL recorded rather than recomputing them.**
The pipeline evaluated each check while it still had the rejected rows in front
of it. Recomputing a verdict from the gold table would be inventing it, because
the rows that would prove a completeness failure are exactly the ones that are
missing.

Locally there is no second process; `npm run dev` alone is the whole
application. README explains how.

---

## 4. Tool surface

Chrome's guidance is explicit that each registered tool consumes context and that overlapping tools make selection worse. So capability scales through **arguments, not registrations**: `breakdown_metric` alone answers roughly forty questions - six metrics against eight dimensions - from one registration. Forty named tools would answer the same questions and make the agent worse at choosing among them.

Registration follows page state, the pattern the spec already uses for login and logout. Nothing is gated by identity; tools appear when they become **relevant**, keeping the visible surface small while the answerable space stays large.

Four groups with four lifetimes, all of them declared in `src/mcp/register.ts`,
their tools written in `src/mcp/tools/`. The public catalogue registers eight -
five catalogue tools plus the three promotions tools added afterward. Signing in
swaps those for seven. Opening the report registers two more, and a check coming
back failed registers the two diagnostic tools, so the count on screen runs
9 → 7 → 9 → 11: it dips on sign-in before it climbs, because the public set now
outnumbers the internal one. Nine, not eight, on the public side: `getTools()`
counts the declarative form alongside the eight imperative tools, and the panel
reads `getTools()` straight through. The public set is swapped out rather than
kept, because its tools drive a catalogue that is no longer on the screen, and a
registered tool that cannot move the page is a tool the agent can pick by
mistake.

The count on screen is what a judge watches move, dip included.

Two tools that were planned are not there. `find_drivers` was cut, as the rank
in §8 says. `compare_periods` was not built either, and its main job is
absorbed: `/api/query` always runs the preceding period of equal length, so
every figure the read tools return already carries its delta.

### The declarative tool

`search_catalog_form` is registered by nobody. The catalogue search box in
`src/ui/public/header.tsx` carries `toolname`, `tooldescription` and
`toolautosubmit`, its two fields carry `toolparamdescription`, and Chrome 152
turns that into a tool with no JavaScript at all. Measured 2026-08-29.

The browser synthesises the JSON Schema from the markup. `<select>` options
become an enum, `min` becomes `minimum`, `type="number"` becomes a number, and a
`required` attribute becomes the schema's required array. Calling the tool fills
the real input and the real select, submits the form, runs the page's own submit
handler, and returns through `SubmitEvent.respondWith`. Values arrive as strings,
the same as any form submission, so a number field still needs parsing.

Its lifetime is the form element's. Signing in unmounts the catalogue header
and the browser drops the tool from `getTools()` unprompted, with no
`AbortController` and none of the reconciler in `register.ts` involved. Nine
tools before the switch, seven after, the form gone along with the rest of the
public set. So the swap-don't-keep rule holds even for the one tool the
reconciler cannot reach.

This is the strongest thing in the project. The rule at the top of §2 is that a
tool must take the same path a click takes, and with a declarative tool the
browser enforces that instead of the developer remembering to. There is no second
code path, and the schema cannot drift from the form, because it is generated from
it. It also removes frontend work rather than adding it: an accessible form
somebody was going to write anyway becomes an agent capability for the price of
three attributes.

The limit is annotations, which are not expressible declaratively. Anything
needing `readOnlyHint` or `untrustedContentHint` stays imperative, which is why
`search_catalog_form` answers with a count and hands off to `search_products` for
the rows. Product copy is third-party text and has to carry
`untrustedContentHint`. See ADR 0004.

Also still marked TBD in the explainer, and untested here: whether declarative
tools support `outputSchema`, and how `step`, `min` and `max` map onto every
JSON Schema construct. Cross-page responses are read from the destination page's
first `<script type="application/ld+json">`, which we do not need, because we
respond on the same page.

### `readOnlyHint`, and why so few tools carry it

The MCP schema defines it as "If true, the tool does not modify its environment.
Default: false." A tool that moves the page has modified its environment, so the
hint goes only on the tools that answer without moving anything. Every other
tool calls a store setter and is marked false.

Marking every read-oriented tool true would have been the flattering answer
rather than the correct one, and a judge who knows the spec will check.
`build_deck` is the one arguable case, since it reads the sections `draft_report`
already committed and mutates nothing, so by the letter it qualifies. It is left
false deliberately, because it produces an artifact a person then acts on and
hands around, and a client that auto-approved that with no human in the loop is
not what anyone wants. Do not "fix" it.

**Sequencing happens through return values, not nesting.** A tool's response is context the agent reads, so it's where you steer what comes next:

```ts
return { content: [{ type: "text", text:
  "Drafted 5 of 9 sections. France, Germany, Italy and the Netherlands " +
  "are BLOCKED: all 3,043 order lines behind net_revenue for this period " +
  "lost their exchange rate, so there is no figure to publish for any of " +
  "them. Online is DEGRADED, a quarter of its lines went the same way. " +
  "Use explain_data_issue to tell the user why, then publish the rest or " +
  "wait for a reload."
}]};
```

Register only from your own modules, per CLAUDE.md's Conventions - one
sentence about it in the writeup reads as real engineering maturity.

### The metric registry

`shared/metrics.ts` is the one definition of every metric: its label, its unit,
the SQL expression behind it, its grain, the dimensions it can be split along,
its exclusions and its lineage. The server builds SQL from it and the client
builds tool schemas from it, so read it there rather than describing it here.

Three things in it are not what a first guess produces, and each was measured
against the Contoso source before it was written down.

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

SuperWeb has two faces on one origin, and README describes what the catalogue
turned out to be. The argument for it belongs here: one origin serves two
different tool surfaces decided by session, with the agent configuring nothing
and holding no credential, where a hosted server would need two endpoints and
two sets of credentials to do the same thing.

Be exact about what this is not. Tool registration happens in the browser, so
the split is **not a security boundary** - anyone with devtools open can call
the internal setter and register the internal tools. The real boundary is server
side, in `api/_lib/session.ts`, which decides the depth of every answer. That is
the same framing as §6: identity, not security.

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
The FX gap hits the four euro countries; North America is sound. A verdict that
could not see the filter would block five good sections to protect four.

| Verdict | Meaning | Renders as |
|---|---|---|
| `ok` | Every check passed for this slice | The number |
| `degraded` | Something is off but the number stands | The number, with a noted gap |
| `blocked` | The number has not earned publication | BLOCKED, never a number |

### What the planted defect actually produces

Measured against the source for `2023-11`, with sections scoped by
`store.CountryCode`:

One section per country the pipeline recorded a check for. There is no "Europe"
grouping at any layer: `DimensionId` has no continent, `dim_store.country_name`
has no such value, and `draft_report`'s `defaultSections` builds straight from
the check file.

| Section | Order lines | Unmatched | Verdict |
|---|---|---|---|
| Germany | 1,739 | 1,739 · 100.00% | `blocked` |
| Netherlands | 665 | 665 · 100.00% | `blocked` |
| France | 410 | 410 · 100.00% | `blocked` |
| Italy | 229 | 229 · 100.00% | `blocked` |
| Online | 18,831 | 4,788 · 25.43% | `degraded` |
| United States | 5,743 | 0 · 0.00% | `ok` |
| Canada | 1,511 | 0 · 0.00% | `ok` |
| United Kingdom | 1,082 | 0 · 0.00% | `ok` |
| Australia | 874 | 0 · 0.00% | `ok` |

The four blocked countries total 3,043 lines. Month-wide that is 7,831 unmatched
lines of 31,084, or 25.19%.

This is better than the plan originally asked for. Four sections publish, four
block, **and** one is genuinely degraded, so all three verdicts get exercised by
real data instead of `degraded` sitting frozen into the contract and never
rendering. Its rendering is no longer a decision to defer.

**Scope sections by `store.CountryCode`, not `customer.Continent`.** Continent
puts Great Britain in Europe, which mixes clean GBP revenue into the broken EUR
slice and turns four clean 100% blocks into one ambiguous 75%. It also collapses
nine sections into three. Every country is its own section.

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
- **The report gets an author.** *"Prepared by Maya Okonkwo · Kestrel Supply Co."* under the report heading. Tiny detail, disproportionate realism. It is hardcoded rather than read from the session, and there is no `.pptx` footer to put it in, so this is half built.
- **The anonymous visitor is a real audience, not a rejection.** `public` is a depth like the others. The catalogue answers at catalogue depth and never returns an error for not being signed in. See §4.

Keep both `explain_data_issue` and `trace_lineage` as separate tools - the agent should still be able to ask for the technical version explicitly. Identity adjusts the *default depth* of the response, not which tools exist.

---

## 7. The demo arc - three minutes

| Time | | |
|---|---|---|
| **0:00** | *"Draft me the November revenue report for the exec review."* | Period `2023-11`. `start_report` → report opens → **tool count jumps 7 → 9 on screen** → `draft_report` |
| **0:40** | Nine sections fill in. France, Germany, Italy and the Netherlands come back **blocked**, Online comes back **degraded**. | *"I can't publish France, Germany, Italy or the Netherlands - every order line behind them is missing its exchange rate for this month. Online is short about a quarter of its lines for the same reason, so its total is understated."* **Tool count jumps to 11** as the failed check registers the diagnostics |
| **1:20** | *"What do you mean, missing?"* | `explain_data_issue` - plain language, no jargon. Publishes the other five with the Online gap flagged |
| **2:00** | *"Make it a deck."* | `build_deck` → the slide outline, with a closing slide naming what was not published rather than dropping it silently |
| **2:30** | Same question, technical depth | `trace_lineage` → the stage ladder, and 31,084 in · 23,253 out · **7,831 rejected** at the FX join |
| **2:45** | *"Nobody had to notice. That's the point."* | Open the video on the same line inverted |

**Opening line:** *Every week, someone pastes a dashboard number into a deck, and nobody checks whether it was real.*

---

## 8. What is left, and what gets cut

The build happened, in one day, both people, in dependency order: the shared
contract first, then the two tracks in parallel, data one side and tools the
other. Gate 0 passed on 2026-08-29 with a correction to the API name
(`document.modelContext`, not `navigator`) and a change to how the defect gets
made (planted, not found - ADR 0003). What the browser API actually does, as
measured rather than as the explainer describes it, is recorded in
`src/mcp/model-context.d.ts`. What remains is in §0, and the remaining days are
not build days: treat any code written in them as a regression risk against a
demo that already works. Polish, record a video with a backup take, submit
mid-morning on the 3rd.

### Tool rank

This is the ranking that stopped anyone building `find_drivers` at 2am while
`draft_report` was still broken. It is still the cut list if the freeze bites:
everything from 9 down was stretch, and cutting starts at the bottom.

| # | Tool | | As built |
|---|---|---|---|
| 1 | `list_metrics` | core | built |
| 2 | `get_metric` | core | built |
| 3 | `breakdown_metric` | core | built |
| 4 | `describe_metric` | core | built |
| 5 | `check_data_trust` | core | built |
| 6 | `filter_dashboard` | core | built |
| 7 | `draft_report` | core, the demo | built |
| 8 | `explain_data_issue` | core, the demo | built |
| 9 | `trace_lineage` | stretch, pull back first | built |
| 10 | `start_report` | stretch | built |
| 11 | `compare_periods` | stretch | not built. `/api/query` returns the prior-period delta on every row, which is most of what it was for |
| 12 | `build_deck` | stretch | built, as a slide outline |
| 13 | `find_drivers` | stretch, cut first | cut. It overlaps `breakdown_metric` |

The catalogue tools, the promotions tools and the declarative form are not on
this list, because the public surface was not in the plan when the list was
written. They rank below everything above and above nothing.

> **Gate:** the agent answers an unrehearsed question correctly, and a section
> gets blocked in plain language without anyone touching a switch.

## 9. Risks

| | Risk | Response |
|---|---|---|
| **HIGH** | **Mid-turn tool registration is undocumented.** The spec doesn't say whether the agent sees newly registered tools in the same turn | Still open. Page-side is settled - `toolchange` fires and `getTools()` updates - but agent-side same-turn visibility is documented nowhere. If it fails, register the report tools when the panel opens via UI instead |
| CLOSED | **Origin-trial token bound to the wrong origin.** The dev machine has the feature on by flag and hides this entirely | The token in `index.html` binds to `https://webmcp-superweb.vercel.app`, expiring 2026-11-17. Renaming the project needs a new token |
| **HIGH** | **One build day means no second attempt.** A track that stalls has no later day to absorb it | The tool rank in §8. Stop building down the list the moment the demo arc runs end to end |
| MED | **Wrong tool selection**, the most common way a WebMCP demo dies | Eleven at once is enough for confusion. Descriptions are prompts: tune against real transcripts, not by reasoning about them |
| MED | **A `.pptx` download is blocked in the in-app browser** | Response taken. `build_deck` is rank 12 in §8 and returns a slide outline rendered in the page. PptxGenJS is not installed and no file is offered |
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

One was taken and then given back. The identity switcher was unbuilt for most
of the build: `src/auth/` was two comment lines per file and `nav-user.tsx`
hardcoded `DEMO_USERS[0]`, so nothing wrote the `superweb_session` cookie that
`api/_lib/session.ts` reads and the audience mechanism was live on the server
and unreachable from the page. It is built now. `signIn` writes the cookie and
moves the surface, the sidebar switches between the three seeded people, and
`restoreSession` puts a reload back where the cookie already pointed.

The rest of the list stands. The stage ladder and all eight registry
dimensions are built. It stays live for the days that are left, and it
is still cut from the top.

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
