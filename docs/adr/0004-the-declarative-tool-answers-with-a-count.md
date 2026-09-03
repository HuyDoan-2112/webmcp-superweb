# Keep supplier copy out of the declarative result

Chrome creates `search_catalog_form` from the catalogue form's HTML. The
browser fills the real controls, runs the existing submit handler, and keeps the
tool's schema aligned with the form.

Declarative tools cannot set `untrustedContentHint`. Product and brand text
comes from the supplier, so the form returns only the matching count, page
number, and a pointer to `search_products`. The imperative tool returns the
rows with `untrustedContentHint: true`.

This adds one tool call. We accept it because returning supplier copy without the
annotation would make its provenance depend on the current synthetic dataset.
Revisit the decision if declarative WebMCP gains annotations.
