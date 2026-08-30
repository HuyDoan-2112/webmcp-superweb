# Adding a tool

The reasoning behind this folder was scattered across file headers in
`register.ts`, `adapter.ts`, `catalog.ts`, `read.ts` and `api.ts`. This
collects it, because the pattern is only worth having if the next person can
follow it without reading five files first.

It lives here rather than in `CLAUDE.md` because it is about this folder, and a
recipe drifts fastest when it sits far from the code it describes.

## Start by not adding one

**The strongest rule in this codebase is that capability scales through
arguments, not registrations.** `breakdown_metric` answers roughly forty
questions from one registration: six metrics against eight dimensions. Forty
named tools would answer the same questions and make the agent worse at
choosing between them. `docs/PLAN.md` §9 puts a number on it: eleven at once is
enough for confusion.

So the first question is never "what should this tool be called". It is:

1. **Can an existing tool answer this with one more argument?** If yes, add the
   argument. The chart is the worked example: it is a `chart` boolean on
   `get_metric` and `breakdown_metric`, not a `chart_metric` tool that would
   have duplicated `metric`, `period` and `dimension` and overlapped
   `breakdown_metric` on every call.
2. **Can an existing tool answer this by returning more?** If yes, widen the
   return value and change no schema at all. `breakdown_metric` returns a pipe
   table rather than aligned prose; that was a return-value change, because a
   `format` enum would have been one more thing for the agent to get wrong in
   exchange for output it can have for free.
3. **Is it named after a question rather than a capability?** `get_coupons_today`
   was rejected for exactly this: it needs a sibling the moment somebody asks
   about tomorrow. `list_promotions` takes a date instead.

Only when all three are no is the answer a new tool.

## Settled forever

These are not per-tool judgement calls. Changing one of them is changing the
architecture, and needs saying out loud first.

- **A tool never queries data itself.** It drives the UI through the store, and
  the UI reads `/api/*`. A tool that composed SQL would be a badly-hosted MCP
  server. `src/mcp/api.ts` is the only read seam and its header says where the
  line sits.
- **A tool that moves the page goes through the store**, never around it, so the
  human and the agent share one state path. `src/store.ts` has a "Public
  surface" block listing which setter each tool drives.
- **Schema enums are built at registration time from real data** - metric ids
  from `shared/metrics.ts`, catalogue facets from an `/api/products` probe,
  promotion codes from `data/meta/promotions.json`. The agent cannot name a
  thing that does not exist, because the browser will not let it.
- **Tools are registered only from modules imported here.** Never from fetched
  content; runtime registration has a published attack surface.
- **Sequencing happens through return values, not nesting.** A tool's response
  is context the agent reads, and that is where the next step gets steered.
- **Registration follows page state and never identity.** Nothing here refuses
  anyone anything. The surface swap is not a security boundary; the server
  decides answer depth. See `CONTEXT.md` on surface versus audience.

## Per-tool judgement

- **Which group.** `public` while the catalogue is on screen, `internal` once
  someone has signed in, `report` while the report is open, `diagnostics` once a
  check has failed. A new group needs a real page condition that is sometimes
  absent: promotions did **not** get one, because they are a committed file and
  are therefore always there, so a gate on "a promotion exists" would have been
  theatre.
- **`readOnlyHint`.** The MCP definition is "does not modify its environment",
  and the page is the environment. A tool that calls a store setter is `false`
  even when the change is trivially reversible.
- **`untrustedContentHint`.** True for third-party text: product names, brand
  names, supplier copy. False for text we wrote, which is why the promotions
  tools carry `false` while `catalog.ts` carries `true`. This one reads
  backwards at a glance, so say why in a comment.
- **What the return value steers toward.** Name the tools the agent can actually
  see. A public tool must never point at an internal one.

## The steps

1. Decide it is a tool at all, using the three questions above.
2. Write it in a module under `src/mcp/tools/`, exporting a factory that
   returns `ToolSpec[]`. Take the enum source as an argument if it needs one.
3. Drive the store first in `execute`, then read `/api/*` for the answer, so the
   number reported is the number on screen.
4. Set both annotations deliberately and comment the reasoning.
5. End the return value with what to call next, and why.
6. Add the factory to a group in `register.ts`.
7. Run `npm run typecheck`.

## Two worked examples

**The promotions set** (issues #21, #25): three tools joined the existing public
group with no new gate. `check_promotion` reads a verdict rather than
registering the internal `check_data_trust`, because that tool answers in the
internal register - check names, run ids, row counts - for an audience the
server deliberately answers differently. The page shows selection only; the
verdict is the tool's return value, because a page that told a shopper the
number was bad would make the tool redundant.

**The chart** (issues #22, #28, #29): no new tool at all. A `chart` argument on
two existing tools, pointing at `/api/chart`, which renders the same Recharts
module `TrendChart` renders. The endpoint stamps the trust verdict into the
image, because an image travels where a transcript does not.
