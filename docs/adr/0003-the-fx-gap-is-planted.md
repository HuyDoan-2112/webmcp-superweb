# The FX gap is planted in bronze, not found and not faked

The demo rests on a missing exchange rate, and the plan assumed Contoso would
supply one. It does not. The `currencyexchange` table is a complete 25-pair by
3,653-day cross product with no holes, and all 2,098,633 order lines resolve a
rate. There is no natural failure anywhere in the source to point a tool at.

So the failure gets made. `01_bronze.sql` deletes the 30 `EUR -> USD` rows for
November 2023 immediately after load, under a comment that says exactly what it
is doing and why. Everything downstream then behaves as if a feed had broken:
silver's FX join drops 7,831 of the month's 31,084 order lines, `checks.py`
records a real failure, and `pipeline_runs.json` carries row counts that do not
reconcile because they genuinely do not.

The alternative was to leave the pipeline clean and hard-code the verdict at the
trust layer, which is a few lines instead of a mutation nobody expects to find
in an ETL. It was rejected for the same reason ADR 0001 keeps the pipeline real.
`trace_lineage` is worth something only if the chain it walks ends at a stage
that actually failed; a verdict typed into a JSON file is a claim about a
pipeline rather than a fact about one, and the rejected-row counts stop being
reproducible by running `npm run etl`.

The cost is that the ETL contains a deliberate act of sabotage, which is a
surprising thing to find in a repository. That is accepted, and paid for by
making it loud: its own commented block, this ADR, and a paragraph in
`etl/README.md`. The one thing that must never happen is the delete becoming
quiet enough to read as a bug.

## The second construction, noted 2026-09-01

An audit pointed out that the deletion is not the only thing this pipeline
constructs. Contoso's amounts are already USD-denominated, so silver declaring
them local currency in order to convert them is itself an assumption, and the
FX join only has something to do because of it.

That is fair and it stands. Two constructions, not one: the pipeline assumes a
denomination, then breaks the conversion that assumption creates. Neither is
hidden, both are in `etl/README.md` under "Currency denomination", and the
consequences of both are reproducible by running `npm run etl`.

What was rejected was quietly restating the assumption as a discovery. A demo
resting on a constructed failure is honest when it says so and dishonest when it
implies the data came that way. The rejected-row counts, the verdicts and the
lineage chain are all real; the denomination underneath them is assumed. A
reader who disagrees with the assumption can now say exactly which line they
disagree with.
