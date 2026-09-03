# Scope trust verdicts to the exact slice

A trust verdict is keyed by metric, period, and filter. A month-wide result
cannot stand in for one country or channel because November 2023 contains clean,
degraded, and fully blocked slices at the same time.

The verdict type is `ok | degraded | blocked | unchecked`. `degraded` keeps
the figure with its missing-row warning. `blocked` withholds the figure.
`unchecked` means the pipeline recorded no check for the exact slice, so
silence never becomes approval.

The first version had only three values and reduced an empty check set to
`ok`. It also fell back to the whole-period check when no scoped check matched.
Both behaviors produced confident answers about data the pipeline had never
checked. `isPublishable` in `src/mcp/structured.ts` is now the shared gate.
