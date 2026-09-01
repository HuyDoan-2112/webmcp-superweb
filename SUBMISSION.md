# SuperWeb

The dashboard that knows when not to answer.

Live: https://webmcp-superweb.vercel.app
Source: https://github.com/HuyDoan-2112/webmcp-superweb
Licence: MIT

## The problem

Someone pastes a dashboard number into a deck and nobody checks whether it was
real. The number that causes the damage is not the obviously broken one. It is
the one that looks normal.

In this dataset, November 2023 lost the euro exchange rates. Four countries
vanish from the result entirely, which is loud. The Online channel keeps a
figure that looks like every other month while 4,788 of its 18,831 order lines
were never counted. That is the dangerous one.

## What the person and the agent each do

The agent decides what may be written. Before drafting any section it reads the
canonical figure back from `/api/query` and the quality verdict from the
pipeline's own check file, then publishes, warns, or refuses per section. It
cannot supply a figure: `draft_report` has no numeric input.

The person decides whether it may be sent. The drafted report lands on the page
marked "Agent draft, awaiting your review" with an Approve for export button.
`build_deck` refuses while that flag is false, and no registered tool can set
it. An agent that could approve its own draft would make the step theatre.

## Why this needs WebMCP rather than a hosted MCP server

A remote analytics server can query the warehouse. It does not know which
number is on the screen, which surface is open, whether a check has failed, or
whether the warning will still be attached when the figure moves into a
document. SuperWeb registers and removes capabilities as the page changes: the
catalogue tools swap for dashboard tools at sign-in, report tools appear when
the report opens, diagnostic tools appear once a check has failed, and a
camera's preview recipe appears only while that camera is open. Every tool
drives the same store setters a click drives, so the person watches the page
move as the agent works.

## Ninety seconds, three prompts

Chrome 149 or later. The deployed origin carries a WebMCP origin trial token,
so no flag is needed there. Clear site data first: a leftover session cookie
opens the app on the dashboard and skips the surface swap.

**1. Draft the report**

> Sign in as Maya and draft the November 2023 net revenue report by country.
> Publish only figures the pipeline supports, and explain anything you refuse.

Four countries publish. France, Germany, Italy and the Netherlands publish no
figure. Online publishes with its gap stated in the same sentence as the
number. The report appears on the page, unapproved.

**2. Ask why two failures are treated differently**

> Why does Germany have no publishable figure while Online still has one that
> cannot be trusted without a warning?

Germany lost 1,739 of 1,739 lines, so there is nothing to state. Online lost
4,788 of 18,831, so the figure stands with the shortfall attached. The
diagnostic tools registered when the failed check was discovered.

**3. Change who is asking**

> Switch to Tom on Data Platform and trace the lineage behind Germany's missing
> revenue.

The same failure, answered at a different depth: check name, row counts, and
the lineage page rather than a business sentence.

Then press Approve for export and ask the agent for the deck. Ask before
approving and it refuses.

## Architecture

`etl/` runs DuckDB over the Contoso dataset, bronze to silver to gold, and
writes the checks and run metadata that everything downstream reads. `api/`
serves the gold parquet read-only. `src/mcp/` registers the tools. A tool never
queries data itself: it drives the UI, and the UI calls `/api/*`, the same path
a click takes.

## What was measured

Every number here came from the committed data, not from prose.

| Fact | Value | Source |
| --- | --- | --- |
| November order lines rejected | 7,831 of 31,084 | `data/meta/quality_checks.json` |
| Countries blocked outright | France, Germany, Italy, Netherlands | same |
| Online lines missing | 4,788 of 18,831, 25.4 per cent | same |
| Public tools registered | 12, rising to 13 on a camera | `docs/probe-preview.mjs` |
| A fabricated $999,999 reaching the page | never | `docs/probe-report-flow.mjs` |
| Deterministic scenarios passing | 20 of 20, against the live deployment | `npm run eval` |

The exchange rate gap is injected on purpose, by two lines in
`etl/sql/01_bronze.sql`. Everything downstream of those lines is real: the
rejected joins, the checks, the counts, the lineage, and the refusal.
`docs/adr/0003-the-fx-gap-is-planted.md` says so and names the line.

## Verifying it

```bash
npm run verify          # typecheck and build
npm run dev             # then, in another shell:
npm run verify:webmcp   # three real-Chrome probes
npm run verify:origin-trial  # the production token, with the flag off
npm run eval            # 20 deterministic scenarios, pass or fail
```

The probes drive the app through `document.modelContext` in real Chrome and
print what the browser did. They are the reason the claims above are stated
rather than hedged.

`npm run eval` is the deterministic half of Chrome's suggested WebMCP
evaluation. Every scenario calls a tool with fixed arguments and asserts on
what came back, so it measures what the tools do. The run below is against
https://webmcp-superweb.vercel.app, not a local server:

| Group | Scenarios | Passing |
| --- | --- | --- |
| Contextual registration and unregistration | 5 | 5 |
| The human approval boundary | 4 | 4 |
| Verdicts matching what the pipeline recorded | 3 | 3 |
| Refusing malformed or invented input | 3 | 3 |
| A number without evidence reaching the page | 3 | 3 |
| Reading the catalogue and the authored profile | 2 | 2 |

The half it does not measure is whether a model picks the right tool, supplies
the right arguments, or recovers from an ambiguous prompt. That needs real
model runs, which are not in this repo, so no number here should be read as a
claim about model behaviour.

## Known limits

`build_deck` returns a slide outline rather than a .pptx file. The demo session
is identity, not security: registration happens in the browser and is not a
security boundary, which is why the server decides how deep an answer goes.
Quality checks exist for country and channel, so a question scoped by category
answers `unchecked` rather than `ok`, and that is deliberate.
