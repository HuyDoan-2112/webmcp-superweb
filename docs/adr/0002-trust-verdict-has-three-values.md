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
