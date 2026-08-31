# What this build measured against the WebMCP open questions

The explainer tracks a set of open design questions. Building SuperWeb against
Chrome 152 produced evidence for several of them. Everything below was measured
with `node docs/probe-modelcontext.mjs` and `node docs/probe-report-flow.mjs`,
not read off the explainer. Rerun both before trusting any line here.

## Multimodal input and output

**Measured: tool results are text only.** `execute` must resolve to
`{ content: [{ type: "text", text }] }`. Chrome 152 returns no other content
type, and the IDL hands `executeTool` back a serialised JSON string.

This decided a feature. We wanted product photography an agent could compare
across two products, the way a person compares two listings before buying. There
is no transport for it: an image has to become a URL inside a text field, and
then the agent is fetching from the network rather than receiving from the page,
which gives up the property that makes WebMCP interesting. We shipped
`product-image.tsx`, which draws a deterministic figure from the catalogue
record, and left the comparison to text.

The gap is real and specific. A shopping agent cannot see what it is buying.
Product comparison is one of the most obvious uses of a tool-exposing web page,
and it is exactly the use that text-only results cannot serve. Nearly every
frontier model now takes images, so the limit is the wire, not the model.

Issue #41 says images "seem like a basic use-case we should support" and has no
concrete proposal on it. Here is one, from having wanted it and gone without.

The interesting property of WebMCP is that the agent receives from the page
rather than fetching from the network. An image returned as a bare URL throws
that away: the agent then makes its own request, with its own headers, possibly
unauthenticated, possibly to a different origin, and the page cannot know what
came back. So the content entry should carry the bytes the page already has.

    { type: "image", data: <Blob | ImageBitmap>, mimeType: "image/webp", alt: "..." }

A `Blob` is the web's own answer here and needs no new serialisation. The page
already holds one for anything it has drawn or fetched, and structured clone
moves it without a copy the author has to write. For the common case where the
image is already a same-origin resource the browser has cached, a variant
carrying a URL plus an integrity hash would let the agent accept it without a
second network trip.

The `alt` field is not decoration. A tool returning an image with no text
alternative is unreadable to a text-only agent and to a screen reader alike, and
the same string serves both.

## Output schema

**Every steering decision in this repo was a workaround for not having one.**
`inputSchema` is enforced by the browser; nothing validates the way out. Since
this was first measured, `check_data_trust` and `draft_report` grew a hand-rolled
substitute: `src/mcp/structured.ts` appends a fenced JSON block after the prose,
built from the same values, so an agent that parses gets `verdict`,
`rejectedRows`, `expectedRows` and `runId` as fields instead of a paragraph it
has to read correctly. Every other tool still answers in prose alone, and that
is why our returns generally stay shaped as flat labelled records rather than
sentences, one return naming one next tool with exact arguments.

It is still not `outputSchema`. Nothing enforces the block's shape and
`getTools()` advertises none of it, so an agent has to know to look. The
three-value verdict in `docs/adr/0002-trust-verdict-has-three-values.md` is the
kind of contract a real `outputSchema` would declare rather than leave to
convention. See the header of `src/mcp/structured.ts` for the absence argument
we would bring to https://github.com/webmachinelearning/webmcp/issues/9.

## Input and output schema validation

Native input validation would have removed roughly half the defensive code in
`src/mcp/tools/`. Two failures we hit and had to hand-guard:

- A section given `dimension` with no `value` silently widened into a
  whole-month check, and a month-wide verdict was written under a heading naming
  one country. `draft_report` now refuses the section.
- A dimension the registry does not know coerced to `undefined` and did the
  same. `check_data_trust` now refuses.

Both are schema violations. Both reached `execute`. An `enum` in `inputSchema`
is documentation to the model, not a gate.

**Output validation is the more interesting half, and we would not want it
naively.** Our tools deliberately withhold: a blocked slice is never queried, so
its figure cannot appear even by accident. A validator that required a `value`
field on every result would fight that. Absence has to be expressible -
`structured.ts` already does this by hand, dropping the key rather than sending
a null or a zero.

## Skills integration

We have a five-call user journey and no way to declare it: `start_report`,
`draft_report`, `check_data_trust`, `explain_data_issue`, `trace_lineage`.
Today the sequence is carried entirely in return values, which works and is
fragile, because it depends on the model reading prose in the order we wrote it.

The registration groups in `src/mcp/register.ts` are a skill boundary drawn by
hand: four sets with four lifetimes, opened and aborted as page state changes. A
skill primitive would let the page say "these five tools are one journey, in this
order" instead of encoding it in text.

## User prompting and elicitation

Our answer is that the page is the confirmation surface. `draft_report` is
`readOnlyHint: false` deliberately: it produces an artifact a person then acts on
and hands around. Rather than prompting, the tool writes into the report the
human already has open, so the human sees the result at the moment it is
produced. That works because the page is visible. It would not work for a tool
in a background tab or a service worker, which is where elicitation is needed.

## Tool progress reporting

Not needed here. Every tool answers in well under a second. Worth noting as a
negative result: for a read-heavy dashboard, progress is not the missing piece.

## Cross-document tool response

We hit the adjacent case rather than navigation. Our declarative form tool,
`search_catalog_form`, is registered by the browser from markup in
`src/ui/public/header.tsx`. When React unmounts the form, the browser
unregisters the tool. That is the correct behaviour and we verified it. But it
means a declarative tool's lifetime is tied to a DOM subtree, and a page that
re-renders during a tool call is a case the author has to think about with no
primitive to help.

One measured detail worth recording: **the browser re-synthesises a declarative
tool's schema after the markup changes.** A `<select>` whose options arrive from
an async fetch still ends up with a real `enum`, not the empty one it first
renders with. We changed the category list from a hardcoded array to live facets
specifically because a wrong enum is worse than a slow one, and the probe
confirmed the enum carries all eight live categories.

## Built-in agent exposure, and `exposedTo`

Not exercised. We register only from our own modules and expose to the top-level
document, which is the whole of our defence against the published attack surface
of runtime registration.

The proposed default (top-level exposes, iframes do not) matches what we would
have chosen. Our concern is the opposite direction: **we would want a way to
say that a tool's *results* are untrusted even when the tool itself is ours.**
`untrustedContentHint` exists and we set it on the catalogue tools, because
product and brand copy is the supplier's rather than ours. The explainer lists
the annotation as a proposed mitigation without implementation, so today it is a
label the consumer may ignore.

## Service workers

The case for it, from this build, in one line: **the page had to invent a
subscription primitive because it does not have one.**

`list_promotions` returns a `recheck_after` date per promotion, which is the day
that promotion's window closes and the answer stops being current. That is the
whole of what a mailing list would give a shopper, minus the address, minus the
account, minus an OAuth layer between the agent and a mailbox.

It is deliberately a fact and not an instruction. A site that writes imperatives
into content an agent reads has built prompt injection and called it a feature.
What a site can honestly publish is when its own answer expires; whether that is
worth a scheduled look is the agent's decision and the person's, and today it
needs an open tab to act on.

## The thing the explainer does not say

`executeTool(tool, args)` takes `args` as a **JSON string**, not an object,
symmetrically with `getTools()` handing `inputSchema` back as a string. Passing
an object throws `UnknownError: Failed to parse input arguments`. This cost an
afternoon and is not in the explainer. See the header of
`src/mcp/model-context.d.ts`.

## Designed and not built: reviews

The catalogue has no reviews, and the reason is worth recording because the
first instinct was that reviews would contradict the project.

They would not, if the tool over them behaves the way the rest of this build
behaves. Reviews are third-party claims, which is what `untrustedContentHint`
is for, and a `read_reviews` tool that returned them verbatim and refused to
compress them into a single star rating would be a second instance of the same
argument: a number nobody counted should not be printed as though someone had.
"4.6 from 812 reviews" is a metric with no pipeline behind it.

Not built because the submission deadline is closer than the work, and a live
recording matters more than another surface.
