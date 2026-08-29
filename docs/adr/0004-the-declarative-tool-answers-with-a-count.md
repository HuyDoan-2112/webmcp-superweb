# The declarative tool answers with a count, not with products

`search_catalog_form` is the catalogue search box. It carries `toolname`,
`tooldescription` and `toolautosubmit`, its two fields carry
`toolparamdescription`, and Chrome 152 registers it as a WebMCP tool with no
JavaScript. The browser synthesises the schema from the markup, the agent fills
the same two controls a person fills, and the page's own submit handler runs. It
is the cheapest tool in the repository and the only one where the rule that a
tool must take the same path a click takes is enforced by the browser rather
than by us remembering.

It would be obvious to have it return the matching products. It returns the
count, the page number and a pointer to `search_products` instead.

Annotations are not expressible declaratively. There is no attribute that sets
one, and the explainer does not offer a way to reach them from markup. Our own
rule puts `untrustedContentHint: true` on every tool that
returns catalogue text, because product names, brand names and manufacturer
names are third-party copy we did not write and did not review. A declarative
tool cannot carry that hint, so a declarative tool must not return that text.

The alternative was to return the rows anyway and accept an unannotated tool,
on the grounds that the copy is Microsoft's sample data and harmless. Rejected.
The annotation is a claim about where the text came from, not about whether this
particular text is dangerous, and a rule that holds only while the data is
synthetic is not a rule. `search_products` exists, is registered on the same
surface, and carries the hint.

The cost is one extra hop for the agent, which is paid back by the steering text:
the count answers "did that narrow anything", and the handoff names the tool that
answers "to what". The thing to watch is somebody deciding the second call is
wasteful and folding the rows into the form's response. If declarative
annotations ship, this ADR is what gets revisited, and until then the count is
the whole point of the design rather than a limitation of it.
