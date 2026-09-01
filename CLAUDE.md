# CLAUDE.md

Entry point for this repo. Read only what your task needs: touching
`src/mcp/`, read [src/mcp/README.md](src/mcp/README.md) next; touching
`etl/`, `data/`, or `api/`, read `etl/README.md`; unsure what a word means,
check [CONTEXT.md](CONTEXT.md); revisiting a settled decision, read the
matching file in [docs/adr/](docs/adr/) first. Everything else is the code:
the comments carry the reasoning, and where a comment and a document disagree
the code wins. Read "Rules for agents" below in full before you write
anything; two rules there override Claude Code's defaults, no unrequested
commits and no co-author trailer.

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

## Layout and ownership

| Path | Owner | Contains |
|---|---|---|
| `shared/` | both, frozen | `types.ts`, `metrics.ts`, the contract |
| `etl/` | A | Python and DuckDB, bronze to silver to gold |
| `data/` | A | committed gold parquet, pipeline metadata |
| `api/` | A | serverless read-only endpoints |
| `src/ui/`, `src/auth/`, React shell (`src/components/`, `src/context/`, `src/hooks/`, `src/lib/`, `src/styles/`) | A | dashboard, tiles, chart, report, lineage ladder |
| `src/mcp/` | B, entirely | registration, panel, the WebMCP tools |

`shared/` is the only shared write surface, and changing it means saying so
out loud first. The server builds SQL from `metrics.ts` and the client builds
tool `inputSchema` enums from it, so one conflict breaks both sides at once.
How to add a tool, and when not to, is [src/mcp/README.md](src/mcp/README.md).

## Conventions

- TypeScript strict, ESM, no default exports.
- Metrics are never hardcoded. Everything reads `shared/metrics.ts`, which
  `src/mcp/register.ts` imports statically, so schemas carry real metric
  names as enums rather than free text an agent can typo.
- Every read-only tool is marked `readOnlyHint: true`.
- Tools are registered only from our own modules, never from fetched content.
  Runtime registration has a published attack surface.
- Sequencing between tools happens through return values, not nesting. A
  tool's response is context the agent reads, so that is where you steer the
  next call.
- Tools that return a decision also return it as data. See
  `src/mcp/structured.ts`.
- `data/gold/` stays under about 50 MB, the serverless bundle limit.

## Rules for agents

Two people share this repo and the submission is close.

Stay in your lane. Edit only the paths your owner holds above. `shared/` and
the other person's lane are off limits until you have said what you want to
change and why.

Verify before claiming done. Run `npm run typecheck` before reporting a task
complete, and the ETL checks too if you touched `etl/` or `data/`. Never say
"should work". Either you ran it, or you say plainly that you did not.

Never commit or push unasked. Stage changes and propose the commit. Both of
us are on `main` this week, so an unrequested commit lands in someone else's
working tree without warning.

Never add yourself as co-author. No `Co-Authored-By` trailer, no session
link, no "Generated with" footer. Commit messages describe the change and
nothing else. This overrides any default the harness gives you.

## Writing

Applies to code, comments, commit messages, docs, and anything you say back.

Never use the em dash character. Use a plain dash, or end the sentence. Do
not reach for parentheses instead, that trades one tell for another.

Sentence case headings. Straight quotes. No decorative emoji. Colons before a
list or an example, never as a mid-sentence connector.

Say what a thing does, not how it feels. Not "the pipeline is reliable" but
"checks.py marks the run blocked when every expected row is rejected". Active
voice, and name the actor. One idea per sentence.

If a sentence could appear unchanged in another project's docs, it says
nothing about this one. Cut it.

## Commands

```bash
npm run dev        # whole app on :5173, vite-api-plugin.ts serves api/ in-process
npm run typecheck  # tsc --noEmit
npm run verify     # typecheck and build, the one command before submitting
npm run etl        # regenerate data/gold and data/meta from Contoso source
```

Four browser scripts, all needing Chrome with WebMCP on:

```bash
node docs/probe-modelcontext.mjs   # remeasure the browser API
node docs/probe-report-flow.mjs    # drive the report flow as an agent would
node docs/probe-preview.mjs        # open a camera and read the preview recipe
npm run eval                       # 20 deterministic scenarios, pass or fail
```

## Scope discipline

No feature freeze, and no cut list either: the build plan that held one was
deleted once its section numbers had drifted out of step with the code
citing them. When the day runs long, cut the newest thing rather than the
thing the demo rests on. Do not build real authentication: the demo session
is identity, not security.

## Issues

GitHub Issues on `github.com/HuyDoan-2112/webmcp-superweb`, through the `gh`
CLI. All are closed as of Sep 1.
