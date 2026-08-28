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

### Numbers

**Metric**:
One business quantity that can be asked for, defined in exactly one place and
read by both the server and the tool schemas.
_Avoid_: KPI, measure

**Dimension**:
An axis a metric can be split along. Category, store, country, channel.
_Avoid_: breakdown, facet, group-by

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
It changes how much detail an answer contains, never whether they may ask.
_Avoid_: role, permission, access level

**Blocked section**:
A report section rendered without its number, because the data behind it did
not earn the right to be published. The blocked section is the demo.
_Avoid_: error, failure, missing section
