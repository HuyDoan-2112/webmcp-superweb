# A trust verdict has three values and ranges over metric + period + filter

`check_data_trust` could have returned a boolean, or a verdict keyed on metric
and period alone. Both were rejected.

The FX gap hits Europe while North America is sound, so a verdict that cannot
see the filter would block five good report sections to protect four broken
ones, and the demo is four published, four blocked, and one genuinely
degraded. The verdict therefore ranges over **metric + period + filter**.

It carries three values, `ok | degraded | blocked`, because the middle case
(the number stands but something is off) is a real state the report has to
render and a boolean cannot express. `degraded`'s rendering is undecided until
there is a page to look at; the type is frozen now because widening it later
would touch every tool, the API and the report renderer, while an unused third
value costs nothing.

## Superseded, 2026-09-01: there is a fourth value

An audit walked a case this ADR did not consider. `verdictFor` reduced the
matching checks with `"ok"` as the seed, so a slice with no checks at all came
back as a pass. The pipeline records checks for `net_revenue` only, and the
registry exposes six metrics, so `check_data_trust` told an agent that
`gross_profit` for Germany was publishable when nothing had ever looked at it.
Germany's gross profit is built on the same 1,739 rejected order lines.

`checksFor` compounded it. When no scoped check matched it fell back to the
unscoped whole-period check, so Spain, which has no stores, was answered with
November's month-wide `degraded` verdict wearing Spain's name.

Both are now fixed and the type has a fourth value, `unchecked`. It is not a
softer `blocked`: blocked means the pipeline looked and the rows were not
there, unchecked means nobody looked. Conflating them would have made the
dashboard show three of its four tiles as blocked, which is its own lie.

`isPublishable` in `src/mcp/structured.ts` is now the single predicate, because
every caller testing `verdict !== "blocked"` let unchecked straight through the
moment the fourth value existed.
