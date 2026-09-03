# SuperWeb

SuperWeb lets an agent operate a trade catalogue and its revenue dashboard
through tools registered by the page. Every tool shares state and data paths
with the visible React interface, so the person and the agent stay on the same
screen.

| Submission item | Link |
| --- | --- |
| Live app | [webmcp-superweb.vercel.app](https://webmcp-superweb.vercel.app/) |
| Source | [github.com/HuyDoan-2112/webmcp-superweb](https://github.com/HuyDoan-2112/webmcp-superweb) |
| Demo video | [Google Drive folder](https://drive.google.com/drive/folders/1R3K-tyClBycVF9MaB8f4t0El4-RpwHCG?usp=drive_link) |
| Presentation | [YouTube](https://youtu.be/nIOFaWsP4_Y) |
| License | [MIT](LICENSE) |

This file is the source text for the Devpost project story. Devpost does not
require it in the repository, but keeping the story here makes its claims
reviewable beside the code and data.

## Inspiration

I asked an AI to help me choose a camera. It gave me megapixels, aperture, and a
research plan. I already knew the outcome I wanted and the price I could pay.
The remaining work was operating a store: searching its current catalogue,
opening products, comparing the fields it actually had, and keeping the page in
sync with the decision.

An agent can try to do that by reading pixels and guessing which element is the
search box. The website already knows what each control does. WebMCP lets the
page state that directly.

The dashboard side came from the same problem. A revenue figure can look
ordinary after a pipeline loses rows. The page knows which filters are active,
which run produced the data, and which checks failed. The agent should see that
evidence before it writes a number into a report.

## What it does

SuperWeb has two surfaces on one origin.

The public surface is a catalogue of 28 photographed products. An agent can
search and filter it, open and compare products, manage a cart and wishlist,
send a trade enquiry, switch the interface between five languages, and inspect
the claim behind each promotion. These actions move the same store state as a
person's click.

The catalogue records price, colour, weight, brand, and category. It does not
record sensor size, aperture, wattage, or decibel levels. The tools do not fill
those gaps. When a product has a Kestrel-authored profile,
`get_preview_recipe` appears and returns written guidance plus named photo
treatments. The response labels them as the shop's suggestions, not measured
hardware behavior.

Staff sign-in swaps the catalogue tools for dashboard tools. The agent can read
six metrics, split them by supported dimensions, check whether an exact slice
is publishable, draft a report, and trace a number back through the pipeline.

The report is where the safety rule becomes visible. `draft_report` accepts no
numeric value. It reads each figure from `/api/query` and each verdict from the
pipeline record. A sound section gets its figure. A degraded section keeps its
figure with the missing-row warning attached. A blocked or unchecked section
gets no figure.

The person keeps the last decision. A draft lands on the page marked "Agent
draft, awaiting your review." No tool can approve it. `build_deck` refuses until
the person presses **Approve for export**.

## The failure we test

The demo period is November 2023. The ETL deliberately removes the 30 EUR to
USD rates for that month before the silver join. The join then rejects 7,831 of
31,084 order lines.

- Germany loses 1,739 of 1,739 lines. Its report section is blocked and contains
  no revenue figure.
- The Online slice loses 4,788 of 18,831 lines. Its section is degraded and
  keeps the figure with a 25.4 percent shortfall warning.
- The United States loses no lines. Its promotion claim is publishable.
- The camera promotion has no category-level check. Its claim is `unchecked`,
  not approved by silence.

The defect is planted, but its consequences are not hand-written fixtures.
DuckDB performs the join, `checks.py` counts the rejected rows, and the API reads
the generated JSON and parquet files.

## How we built it

The front end uses React 19, TypeScript, Vite, Tailwind CSS, Recharts, and
shadcn/ui components. Vercel serves the production build and the TypeScript API
functions. DuckDB reads committed parquet files for the catalogue and metrics.

`src/store.ts` holds the page state. React components subscribe to it, and
imperative WebMCP tools call its exported setters. Both then read the same API
clients in `src/api.ts`. No tool imports the DuckDB helper or composes SQL.

`src/mcp/register.ts` manages five tool groups:

- `public` while the catalogue is visible
- `internal` after staff sign-in
- `preview` while a profiled product is open
- `report` while the report builder is open
- `diagnostics` after a check returns a non-`ok` verdict

Each group owns an `AbortController`. Closing a group aborts its registrations,
so irrelevant tools leave the agent's tool list when the page changes.

The catalogue search is also a declarative tool. The existing form carries
`toolname`, `tooldescription`, `toolautosubmit`, and field descriptions. Chrome
builds `search_catalog_form` from the markup, fills the real controls, and runs
the same submit handler as a person.

Metric and dimension enums come from `shared/metrics.ts`. Catalogue facets come
from `/api/products`. Promotion codes come from the committed promotion record.
Handlers still validate arguments because the tested browser exposed schema
violations to `execute`.

## Challenges we ran into

### Tool output has no declared schema

The browser advertises `inputSchema`, but the tested WebMCP implementation has
no equivalent contract for results. The trust and report tools append a fenced
JSON block after their prose. Blocked sections omit the figure key instead of
using `0` or `null`, because no figure and zero revenue are different facts.

### Trust has to match the exact slice

An early implementation fell back to the whole-month check when no scoped check
matched. A request for Spain could receive November's overall verdict under
Spain's name. The trust layer now returns `unchecked` when the pipeline recorded
nothing for the exact metric, period, and filter.

### Images do not travel through this tool path

The Chrome build we tested returned text content from WebMCP tools. SuperWeb
therefore returns an authored photo treatment as text. The caller may give that
recipe and their own photo to an image model, but the page never claims that
WebMCP transported or analyzed the image.

### Page context changes the useful tool set

Keeping every tool registered made selection harder and left actions available
for interfaces no longer on screen. Registration now follows page state. The
preview tool even rebuilds when the open product changes, because each profile
has a different look enum.

## What we learned

The useful part of WebMCP is shared context, not a shorter way to call an API.
The agent can move the page, the person can inspect the result, and both can
refer to the same selected product or report draft.

We also learned that a quality verdict needs the same scope as the number it
governs. A month-wide verdict cannot safely stand in for Germany or Online. The
filter belongs in the trust key.

Tool descriptions carry workflow today. `start_report` tells the agent which
tool becomes relevant next, and `draft_report` points to the human approval
step. That works, but it depends on the model reading prose. A first-class way
to describe tool sequences would be stronger.

## What's next

The first extension would be typed tool output with optional fields. The second
would be a page-declared workflow that can express ordering and human approval.
Multimodal WebMCP content would let a product page return the image bytes it has
already loaded instead of making the agent fetch a URL through a separate path.

The current build stops at a slide outline. A production report flow would
create a real presentation only after approval, store the run ID with the
artifact, and keep every degraded warning attached to the figure it qualifies.

## Verification

The repository includes three Chrome probes and 20 deterministic tool
scenarios. They verify registration changes, the preview tool lifetime, report
approval, scoped verdicts, and the rule that an agent-supplied `$999,999` never
reaches the page.

```bash
npm run verify
npm run dev
npm run verify:webmcp
npm run eval
```

These checks measure tool behavior with fixed arguments. They do not measure
whether a language model chooses the right tool from an ambiguous prompt.

Built by Tan Dat Ta and Huy Doan.
