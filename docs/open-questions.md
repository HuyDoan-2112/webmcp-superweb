# WebMCP questions this build tested

SuperWeb was tested against Chrome 152 with:

```bash
node docs/probe-modelcontext.mjs
node docs/probe-report-flow.mjs
node docs/probe-preview.mjs
```

The findings below describe that browser build. Rerun the probes before using
them as claims about another version or client.

## Multimodal content

The tested tool path returned text content in this shape:

```js
{ content: [{ type: "text", text: "..." }] }
```

SuperWeb originally needed product photography inside a comparison result. A
URL in a text field would make the agent fetch the asset through a second
request with different credentials and cache state. The page would no longer
know which bytes the agent received.

The shipped flow keeps the boundary explicit. `get_preview_recipe` returns a
text treatment. A caller may apply it to a photo in a separate image model, but
the photo does not pass through WebMCP.

A useful multimodal result would carry the bytes the page already has, plus a
text alternative:

```js
{
  type: "image",
  data: blob,
  mimeType: "image/webp",
  alt: "Front view of the selected camera"
}
```

`Blob` already supports structured cloning in browsers. A same-origin URL plus
an integrity hash could cover cached assets without making a bare URL the trust
boundary.

## Output schema

The tested API advertised `inputSchema` but no `outputSchema`. Trust decisions
therefore arrived as prose unless the application added its own structure.

`src/mcp/structured.ts` appends a fenced JSON block to trust and report results.
The block is generated from the same values as the prose. It includes fields
such as `verdict`, `publishable`, `runId`, `expectedRows`, and `rejectedRows`.

Optional output fields matter here. A blocked section has no figure, so the JSON
omits the figure key. Requiring a value would collapse "no figure exists" into
`null` or `0`, which are different facts in this dataset.

## Schema validation

Schema violations reached `execute` during development. The handlers still
validate every argument even when `inputSchema` contains an enum.

Two failures shaped that rule:

- `draft_report` once accepted a dimension without a value and widened the
  section to the whole month.
- `check_data_trust` once coerced an unknown dimension to `undefined` and ran
  the whole-period check.

Both returned a plausible verdict for the wrong slice. The current handlers
refuse malformed scope before changing the page.

## Tool sequences

The report flow uses several calls:

```text
start_report
    -> draft_report
    -> check_data_trust when another slice needs inspection
    -> explain_data_issue or trace_lineage after a non-ok result
    -> human approval
    -> build_deck
```

The API has no primitive for declaring this sequence. SuperWeb carries it in
tool descriptions, results, and five registration groups with different
lifetimes. That keeps irrelevant tools out of the list but still depends on the
model reading prose correctly.

A workflow declaration should express ordering, the page condition for each
step, and a human checkpoint that no tool can satisfy.

## Human confirmation

The report page is the confirmation surface. `draft_report` writes its result
into the visible document. The person can inspect blocked sections and degraded
warnings before pressing **Approve for export**.

`build_deck` reads the same `reportApproved` flag as the page and refuses while
it is false. No registered tool can set the flag. This pattern depends on a
visible foreground page, so it does not solve confirmation for a background tab
or service worker.

## Declarative tool lifetime

`search_catalog_form` comes from the form markup in
`src/ui/public/header.tsx`. Chrome removes the tool when React unmounts the
form during staff sign-in.

The probe also found that Chrome rebuilds the declarative schema after the
form's `<select>` options change. The category list begins empty, then receives
eight categories from `/api/products`. The final tool schema contains those
eight enum values.

This behavior keeps the schema aligned with the control. It also ties the tool
lifetime to a DOM subtree, so a re-render during a call needs deliberate testing.

## Result trust

SuperWeb registers descriptors only from imported modules. Fetched data can
populate enum values but cannot define a tool.

Catalogue tools set `untrustedContentHint: true` because their results include
supplier names and product copy. `list_enquiries` also sets it because customer
messages are untrusted text. The annotation is useful metadata, but the tested
browser did not enforce how a client must treat it.

Declarative forms cannot set that annotation. `search_catalog_form` therefore
returns a count and points to `search_products` for rows containing supplier
copy. [ADR 0004](adr/0004-the-declarative-tool-answers-with-a-count.md) records
the tradeoff.

## Background work

Page tools exist only while the page is open. SuperWeb cannot use them as a
subscription or scheduled background task.

`plan_promotion_reminder` returns a promotion window and RRULE but schedules
nothing. The caller can create a reminder elsewhere from that data. A service
worker tool could keep a site-owned capability available in the background, but
it would also need a clear permission and confirmation model.

## Progress events

The current tools complete in under a second during local tests. Progress
reporting did not solve a problem in this build. The cold production catalogue
probe was the exception, and the registration adapter handles it with an
eight-second build deadline and a visible registration log.

## API details missing from the explainer

Chrome 152 exposed `document.modelContext`. `navigator.modelContext` was absent
in the measured run.

`getTools()` returned each `inputSchema` as a JSON string. `executeTool` also
required its arguments as a JSON string and resolved to a serialized JSON
string. Passing an object produced `UnknownError: Failed to parse input
arguments`.

`src/mcp/model-context.d.ts` records that observed shape. The probes are the
source of truth if the browser changes.

## Reviews were considered and cut

The catalogue has no review data. A future `read_reviews` tool should return
individual reviews as third-party text and avoid inventing a star average unless
the page has a reproducible aggregation behind it.

That feature was cut because it did not strengthen the recorded demo. The
existing project already tests the same principle with promotion claims and
report figures.
