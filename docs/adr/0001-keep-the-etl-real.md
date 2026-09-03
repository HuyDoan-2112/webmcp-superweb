# Keep the ETL reproducible

SuperWeb keeps the bronze, silver, and gold pipeline instead of replacing its
outputs with hand-written fixtures. The trust and lineage tools need rejected
row counts that another developer can reproduce with `npm run etl`.

This costs more code than committing only the final parquet and JSON files. We
accept that cost because a typed verdict is not evidence unless the pipeline
that produced it is present and runnable.
