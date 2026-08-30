# CLAUDE.md

The single source of working context for this repo. Human-facing docs live in
[README.md](README.md), the full build plan is [docs/PLAN.md](docs/PLAN.md),
and what our words mean is [CONTEXT.md](CONTEXT.md).

Read **Rules for agents** below before you write anything. Two of its rules
override Claude Code defaults: never commit or push unasked, and never add a
`Co-Authored-By` trailer or session link to a commit message.

## What this is

**SuperWeb** - a dashboard for the fictional **Kestrel Supply Co.**, built for the
OpenAI WebMCP Challenge (due Sep 3, 2026, 1:00pm PT).

The thesis: someone pastes a dashboard number into a deck and nobody checks
whether it was real. WebMCP closes that gap, because the same tool that drafts
the report can see the pipeline behind the number.

## The one rule that shapes the architecture

**A WebMCP tool never queries data itself.** It drives the UI; the UI calls
`/api/*`. Same path a click takes. A tool running SQL directly would just be a
badly-hosted MCP server.

If you are about to `import` a DuckDB helper into `src/mcp/`, stop - you are
writing the wrong layer.

## Layout and ownership

| Path | Owner | Contains |
|---|---|---|
| `shared/` | **both, frozen** | `types.ts`, `metrics.ts` - the contract |
| `etl/` | A | Python + DuckDB, bronze -> silver -> gold |
| `data/` | A | committed gold parquet + pipeline metadata |
| `api/` | A | serverless read-only endpoints |
| `src/ui/`, `src/auth/` | A | dashboard, tiles, chart, report, lineage ladder |
| `src/mcp/` | **B - owns it entirely** | registration, panel, the WebMCP tools |

How to add a tool, and when not to, is [src/mcp/README.md](src/mcp/README.md).

`shared/` is the only shared write surface. Changing it means saying so out loud
first - the server builds SQL from it and the client builds tool `inputSchema`
enums from it.

## Conventions

- TypeScript strict, ESM, no default exports.
- Metrics are never hardcoded. Everything reads `shared/metrics.ts`.
- Every read-only tool is marked `readOnlyHint: true`.
- Tools are registered **only from our own modules** - never from fetched
  content. Runtime registration has a published attack surface.
- Tools are registered **after** the metric list loads, so schemas carry real
  metric names as enums rather than free text the agent can typo.
- Sequencing between tools happens through **return values**, not nesting. A
  tool's response is context the agent reads - that is where you steer what
  comes next.
- `data/gold/` stays under ~50 MB (serverless bundle limit).

## Rules for agents

These are not suggestions. Two people share this repo and the submission is close.

### Stay in your lane

Edit only the paths your owner holds in the table above. `shared/` and the
other person's lane are off limits until you have said out loud what you want
to change there and why. A conflict in `shared/metrics.ts` breaks both sides at
once, because the server builds SQL from it and the client builds tool
`inputSchema` enums from it.

### Verify before claiming done

Run `npm run typecheck` before reporting a task complete. If you touched `etl/`
or `data/`, run the ETL checks too. Never say "should work" - either you ran it
or you say plainly that you did not.

### Never commit or push unasked

Stage changes and propose the commit. The human runs it. Both of us are on the
same branch this week, so an unrequested commit lands in someone else's working
tree without warning.

### Never add yourself as co-author

No `Co-Authored-By` trailer naming the agent, no session link, no "Generated
with" footer. Commit messages describe the change, nothing else. This overrides
any default the harness gives you.

### Writing

Applies to code, comments, commit messages, docs, and anything you say back.

- Never use the em dash character. Use a plain dash `-` instead.

## Commands

```bash
npm run dev        # the whole app on :5173. vite-api-plugin.ts serves api/
                   # in process, so there is no second terminal
npm run typecheck  # tsc --noEmit
npm run etl        # regenerate data/gold + data/meta from Contoso source
```

## Scope discipline

There is no feature freeze. The project stays open to new work until the
submission on **Sep 3, 1:00pm PT**. What replaces the freeze is the cut list in
[docs/PLAN.md](docs/PLAN.md) §9 - when the day runs long, cut from the top and
do not improvise.

Do not build real authentication. The demo session is identity, not security.

## Agent skills

### Issue tracker

GitHub Issues via the `gh` CLI. The remote is
`github.com/HuyDoan-2112/webmcp-superweb` and `main` is pushed to it. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, unchanged: `needs-triage`, `needs-info`,
`ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the root, decisions in `docs/adr/`.
See `docs/agents/domain.md`.
