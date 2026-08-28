# Keep the ETL real rather than replacing it with fixtures

This is a one-day build over synthetic Contoso data, so a bronze-silver-gold
pipeline is the largest single chunk of work and the easiest to fake: we could
generate the gold parquet once and hand-author `data/meta/*.json` as fixtures,
saving hours.

We are keeping the pipeline real anyway. `trace_lineage` and `check_data_trust`
are the whole demo, and their authority comes from pointing at something true.
Rejected-row counts that a reader can reproduce by running `npm run etl` are
evidence; the same numbers typed into a JSON file are set dressing, and a judge
who reads `etl/` would find the difference.

The cost is accepted deliberately: the ETL stays **minimal and unpolished**. It
exists so lineage has a referent, not as a thing to admire.
