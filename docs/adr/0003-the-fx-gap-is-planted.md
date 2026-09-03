# Plant the FX gap in bronze

Contoso's exchange-rate table has complete coverage, so the demo failure does not
occur in the source. `etl/sql/01_bronze.sql` deliberately removes the 30 EUR
to USD rows for November 2023 before the silver join.

The alternative was a hard-coded trust verdict. We rejected it because the
pipeline would not lose rows, the quality checks would not reproduce the counts,
and `trace_lineage` would point at a failure that never happened.

The pipeline also makes a separate modeling assumption. Contoso's order-row
amounts are already USD-denominated, but silver treats them as local currency
and converts them through the FX join. The join's 7,831 rejected rows are real;
the denomination that makes the join necessary is assumed. Both facts remain
documented in `etl/README.md` so the deliberate construction cannot be mistaken
for a source-data discovery.
