# SuperWeb

A dashboard for Kestrel Supply Co. that exposes WebMCP tools, so an agent
operating the page can tell whether a number deserves to be written down.

This file is a glossary. It records what our words mean, not how anything is
built. Implementation lives in [docs/PLAN.md](docs/PLAN.md).

## Language

### The product

**SuperWeb**:
The product. The dashboard plus the tool surface it exposes to an agent.

**Kestrel Supply Co.**:
The fictional company whose data the dashboard shows. Fictional so the UI reads
as a product seeded with sample data rather than a tutorial built on it.
_Avoid_: Contoso (that is the upstream dataset, not the company we depict)

**Public surface**:
What an anonymous, signed-out visitor sees: the Kestrel product catalogue, with
a small tool set their agent can use to browse it. It is a face of the same
origin, not a separate site.
_Avoid_: landing page, marketing site, guest mode

**Internal surface**:
What a signed-in person sees: the dashboard and the full tool set. Signing in
switches surfaces, which swaps one set of registered tools for the other.

Say "surface" when you mean which tools are registered, and "audience" when you
mean how deep the answer goes. The switch is not a security boundary; README
says why.
_Avoid_: private area, admin, authenticated app, logged-in mode

**Family**:
One product, with every colourway it comes in. The catalogue lists families,
not SKUs: the source carries one row per colour, so a nine-colour camera is nine
rows at one identical price and reads as a duplicated catalogue rather than as a
range. 2,517 rows are 885 families. Say "product" to a reader and "family" in
code, where the distinction from a variant is load bearing.
_Avoid_: group, model, parent product, SKU (a SKU is one variant)

**Facet**:
One value a visitor can filter the catalogue by, carried with the number of
families that would remain if they picked it. Each facet is counted with every
other filter applied but not its own, so a count never promises a page that
turns out empty once you click it. A facet belongs to the catalogue; a dimension
belongs to a metric. They are not the same word for the same thing.
_Avoid_: filter, dimension, aggregation

**Declarative tool**:
A tool the browser registers from HTML, because the form carries `toolname` and
`tooldescription`. Nothing calls `registerTool` and the schema is synthesised
from the markup, so it cannot drift from the control it describes. Everything
else we register is an **imperative tool**, written in TypeScript. The
distinction matters because annotations are not expressible declaratively.
_Avoid_: automatic tool, HTML tool, form tool

### Numbers

**Metric**:
One business quantity that can be asked for, defined in exactly one place and
read by both the server and the tool schemas.
_Avoid_: KPI, measure

**Dimension**:
An axis a metric can be split along. Category, store, country, channel. Channel
is derived rather than read, because the source has no channel column.
_Avoid_: breakdown, group-by, facet (a facet is a catalogue filter
value, not an analytical axis)

**Grain**:
The row level a metric aggregates over. Two metrics at different grains cannot
be compared without saying so.

**Period**:
The span of time a metric is asked for. Always explicit; a metric without a
period is not an answer.

### Provenance

**Lineage**:
The ordered chain from a dashboard metric back to the operational system the
data came from. What `trace_lineage` walks.
_Avoid_: provenance, data flow

**Stage**:
One rung of that chain, carrying a label: dashboard metric, curated table,
transformation, warehouse, operational system. The label is what makes the
chain legible to someone who does not know the table names.
_Avoid_: layer, level, step

**Run**:
One execution of the pipeline that produced the current data. Has a time, a
status, and a set of checks it evaluated.
_Avoid_: job, build, refresh

**Check**:
A named assertion about data quality evaluated during a run. Passes or fails.
Its name is jargon by design and is never shown to a non-technical user.
_Avoid_: test, validation, rule

**FX rate**:
Short for foreign exchange rate. The multiplier that converts an order priced
in a local currency into USD, looked up by currency and by the date of the
order. Rates change daily, so the lookup needs both.
_Avoid_: exchange rate, conversion rate, forex

**Local currency**:
The currency an order was placed in, and the denomination we treat its amounts
as. The Contoso source stores amounts that are already USD-denominated and uses
`CurrencyCode` only to record what the customer paid in. Silver declares those
amounts local and converts them through the FX join anyway, so that a missing
rate drops the line instead of quietly doing nothing. The data is synthetic and
the company is fictional, so there is no ground truth this contradicts.
_Avoid_: "orders priced in non-USD currencies" (the source does not literally
say that), native currency, original currency

**Rejected row**:
An order line that fell out of the pipeline because a lookup it needed found
nothing, most often a missing FX rate. It does not become zero and it does not
raise an error, it simply stops being counted. Rejected rows are the reason a
number can be wrong while looking entirely normal.
_Avoid_: dropped row, lost row, bad data

**Completeness**:
Whether the rows that should be behind a number actually are. A metric can pass
every other check and still be incomplete, which is the failure this project
exists to surface.
_Avoid_: coverage, data quality

### People and reports

**Audience**:
The depth of answer a person should receive, carried by the demo session.
It changes how much detail an answer contains, never whether they may ask. The
anonymous visitor is an audience like any other and gets catalogue depth, never
a refusal.
_Avoid_: role, permission, access level

**Blocked section**:
A report section rendered without its number, because the data behind it did
not earn the right to be published. The blocked section is the demo.
_Avoid_: error, failure, missing section

**Degraded section**:
A report section that keeps its number and carries the gap alongside it, because
some of its rows were rejected but enough survived to say something true. The
online channel is the one in the demo period, a quarter short and reading as
entirely ordinary. It is the more dangerous of the two states, because a blocked
section cannot be pasted into a deck and this one can.
_Avoid_: partial, warning, incomplete section

### Promotions

**Promotion**:
One synthetic marketing offer Kestrel is running: a code, its copy, the window
it is valid for, and exactly one claim. Invented content, unlike everything
else on the public surface, which is read from the pipeline.
_Avoid_: campaign, offer, deal, coupon (a code is one field of a promotion, not
the promotion)

**Claim**:
The checkable assertion inside a promotion's copy, bound to the one slice of
one metric that would prove or disprove it. A promotion carries exactly one; if
it needs two, it is two promotions. The claim is what makes marketing copy
answerable rather than decorative.
_Avoid_: assertion alone, statement, headline

**Announcement**:
The strip on the public surface that shows live promotions to a visitor. It is
the place, never the record: a promotion is announced on it. Say "promotion"
when you mean the thing and "announcement" when you mean where it appears.
_Avoid_: banner, promo bar, announcement as a synonym for promotion

**Unchecked**:
The state of a claim whose slice the pipeline never evaluated, distinct from a
verdict of any kind. Nobody looked, which is not the same as looked and failed,
and it calls for a different action. It sits above the verdict rather than
inside it, so the three verdicts stay three.
_Avoid_: unverified, unknown, pending, a fourth verdict
