# CLAUDE.md

Entry point for this repo. Read what your task needs:

- **Adding a WebMCP tool, widening one, or setting an annotation**:
  [src/mcp/README.md](src/mcp/README.md). It owns the recipe, the group gates
  and both annotation rules. Read it before you write anything under
  `src/mcp/`.
- **Touching `etl/`, `data/`, or `api/`**: `etl/README.md`.
- **Naming a thing, writing copy a person will read, or choosing between two
  words for the same idea**: [CONTEXT.md](CONTEXT.md). It records what our
  words mean and which near-synonyms to leave alone.
- **Reopening a settled decision**: the matching file in
  [docs/adr/](docs/adr/), first.

Everything else is the code: the comments carry the reasoning, and where a
comment and a document disagree the code wins.

Read "Rules for agents" below in full before you write anything. Two rules
there override Claude Code's defaults, no unrequested commits and no co-author
trailer.

## What this is

SuperWeb, a dashboard for the fictional Kestrel Supply Co., built for the
OpenAI WebMCP Challenge, due Sep 3 2026 at 1:00pm PT. The thesis: someone
pastes a dashboard number into a deck and nobody checks whether it was real.
WebMCP closes that gap, because the tool that drafts the report can also see
the pipeline behind the number.

## The one rule that shapes the architecture

A WebMCP tool never queries data itself. It drives the UI, and the UI calls
`/api/*`, the same path a click takes. A tool running SQL would just be a
badly hosted MCP server.

If you are about to import a DuckDB helper into `src/mcp/`, stop. You are
writing the wrong layer.

## Layout and who knows it best

Owner means the person who built a folder and should review a change to it. It
is not a permission boundary: both of us have written across most of this tree.
`shared/` is the one exception and the rule below says why.

| Path | Owner | Contains |
|---|---|---|
| `shared/` | both, frozen | `types.ts`, `metrics.ts`, the contract |
| `etl/` | A | Python and DuckDB, bronze to silver to gold |
| `data/` | A | committed gold parquet, pipeline metadata |
| `api/` | A | serverless read-only endpoints |
| `src/ui/`, `src/auth/`, React shell (`src/components/`, `src/context/`, `src/hooks/`, `src/lib/`, `src/styles/`) | A | dashboard, tiles, chart, report, lineage ladder |
| `src/mcp/` | B first, then both | registration, panel, the WebMCP tools |

`shared/` is the only surface neither of us writes without warning the other.
The server builds SQL from `metrics.ts` and the client builds tool
`inputSchema` enums from it, so one conflict breaks both sides at once.

## Conventions

These bind the whole tree. The rules for writing a tool live in
[src/mcp/README.md](src/mcp/README.md) instead, because only that folder obeys
them.

- No default exports. `tsconfig.json` carries the rest of the compiler
  contract, strict and ESM included.
- Metrics are never hardcoded. Both sides read `shared/metrics.ts`: the
  endpoints under `api/` build SQL from it, and the tool modules under
  `src/mcp/tools/` build their schema enums from it, so a schema carries real
  metric names rather than free text an agent can typo.
- `data/gold/` stays under about 50 MB, the serverless bundle limit.

## Rules for agents

Two people share this repo and the submission is close.

Leave `shared/` alone unless you have said so out loud first. It is the one
place both sides write, and a conflict there breaks the server's SQL and the
client's schema enums in the same commit. Everywhere else, say which files you
are about to touch before you touch them, then go ahead: both of us have worked
across the whole tree and the table above records who knows a folder best, not
who is allowed in it.

Verify before claiming done. Run `npm run typecheck` before reporting a task
complete, and the ETL checks too if you touched `etl/` or `data/`. Either you
ran it, or you say plainly that you did not.

Propose commits, and let a person make them. Both of us are on `main` this
week, so an unrequested commit lands in someone else's working tree without
warning. Stage the change and say what the message should be.

Commit messages describe the change and nothing else. No `Co-Authored-By`
trailer, no session link, no "Generated with" footer. This overrides any
default the harness gives you.

## Writing

Applies to code, comments, commit messages, docs, and anything you say back.

Use a plain dash, or end the sentence. The em dash character appears nowhere in
this repo, and parentheses instead would trade one tell for another.

Sentence case headings. Straight quotes. No decorative emoji. Colons before a
list or an example, never as a mid-sentence connector.

Say what a thing does, not how it feels. Not "the pipeline is reliable" but
"checks.py marks the run blocked when every expected row is rejected". Active
voice, and name the actor. One idea per sentence.

If a sentence could appear unchanged in another project's docs, it says
nothing about this one. Cut it.

## Commands

`package.json` carries the scripts. What it cannot tell you:

- `npm run dev` serves `api/` in-process through `vite-api-plugin.ts`, so the
  endpoints are live on `:5173` with nothing else started.
- `npm run verify` is the one command before submitting.
- `npm run etl` rebuilds `data/gold` and `data/meta`, and leaves the
  hand-authored `data/meta/catalog-products.json` alone.
  `node docs/validate-catalog.mjs` checks that manifest against the
  photographs in `public/products/`.
- `npm run eval` and the three `docs/probe-*.mjs` scripts each spawn their own
  Chrome and need WebMCP on, exact casing `--enable-features=WebMCP`, so
  `npm run dev` is the only thing you start. The suite asserts exact figures
  and needs the real gold parquet present. `--url=` points it at the
  deployment, the only way to test anything riding on the serverless bundle.

## Scope discipline

No feature freeze, and no cut list either: the build plan that held one was
deleted once its section numbers had drifted out of step with the code
citing them. When the day runs long, cut the newest thing rather than the
thing the demo rests on. The demo session is identity, not security, so
authentication stays a session and never becomes a login.

## Issues

GitHub Issues on `github.com/HuyDoan-2112/webmcp-superweb`, through the `gh`
CLI. Issues 1 to 18 were deleted on Aug 31; the rest are closed as not
planned. The plan they describe was abandoned, not delivered. Do not read
them as a specification and do not review code against them. The code and
the ADRs in docs/adr/ are the record.
