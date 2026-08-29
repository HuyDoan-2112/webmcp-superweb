"""Quality checks, evaluated after gold is built.

A check is a named assertion about the data. Its name is jargon on purpose and
is never shown to a non-technical person; the API turns a failure into plain
language before anyone reads it.

Every check is scoped, because a verdict ranges over metric plus period plus
filter. The FX gap hits Europe while North America is sound, so a check that
could only see the metric and the period would block four good sections to
protect one.
"""

from __future__ import annotations

from typing import Any

# A slice fails outright above this share of missing rows, and is flagged but
# still publishable below it. A number standing on three quarters of its rows is
# not the same problem as a number standing on none.
BLOCKED_THRESHOLD = 0.50
DEGRADED_THRESHOLD = 0.001


def _verdict(rejected: int, expected: int) -> str:
    if expected == 0:
        return "blocked"
    share = rejected / expected
    if share >= BLOCKED_THRESHOLD:
        return "blocked"
    if share > DEGRADED_THRESHOLD:
        return "degraded"
    return "ok"


def _plain_language(scope_label: str, rejected: int, expected: int, verdict: str) -> str:
    """One sentence, no jargon, safe to put in front of anyone."""
    if verdict == "ok":
        return f"Every order line behind {scope_label} was counted."
    share = round(100 * rejected / expected)
    if verdict == "blocked":
        return (
            f"The {scope_label} is not trustworthy. {rejected:,} of the "
            f"{expected:,} order lines behind it were never counted, because the "
            f"exchange rate needed to convert them was missing for those days. "
            f"The number is not low, it is incomplete."
        )
    return (
        f"The {scope_label} is usable but short by about {share} per cent. "
        f"{rejected:,} of {expected:,} order lines were dropped for a missing "
        f"exchange rate."
    )


def run_checks(con: Any, period: str) -> list[dict[str, Any]]:
    """Evaluate fx_rate_not_null across every slice the report can ask for."""
    checks: list[dict[str, Any]] = []

    # Whole period, no filter.
    row = con.execute(
        """
        SELECT
          (SELECT count(*) FROM silver.order_lines_raw
            WHERE strftime(order_date, '%Y-%m') = ?),
          (SELECT count(*) FROM silver.rejected_order_lines
            WHERE strftime(order_date, '%Y-%m') = ?)
        """,
        [period, period],
    ).fetchone()
    expected, rejected = int(row[0]), int(row[1])
    checks.append(
        _check("fx_rate_not_null", period, None, None, "figure for this period", rejected, expected)
    )

    # Per country, and per channel. These are the two axes the report sections
    # are cut along, so these are the verdicts draft_report actually consults.
    for dimension, column in (("country", "country_name"), ("channel", "channel")):
        rows = con.execute(
            f"""
            WITH raw AS (
              SELECT s.{column} AS k, count(*) AS expected
              FROM silver.order_lines_raw l
              JOIN gold.dim_store s ON s.store_key = l.store_key
              WHERE strftime(l.order_date, '%Y-%m') = ?
              GROUP BY 1
            ),
            bad AS (
              SELECT s.{column} AS k, count(*) AS rejected
              FROM silver.rejected_order_lines l
              JOIN gold.dim_store s ON s.store_key = l.store_key
              WHERE strftime(l.order_date, '%Y-%m') = ?
              GROUP BY 1
            )
            SELECT raw.k, raw.expected, coalesce(bad.rejected, 0)
            FROM raw LEFT JOIN bad ON bad.k = raw.k
            ORDER BY raw.k
            """,
            [period, period],
        ).fetchall()
        for key, expected, rejected in rows:
            checks.append(
                _check(
                    "fx_rate_not_null",
                    period,
                    dimension,
                    key,
                    f"{key} figure",
                    int(rejected),
                    int(expected),
                )
            )

    return checks


def _check(
    name: str,
    period: str,
    dimension: str | None,
    value: str | None,
    scope_label: str,
    rejected: int,
    expected: int,
) -> dict[str, Any]:
    verdict = _verdict(rejected, expected)
    return {
        "name": name,
        "metric": "net_revenue",
        "period": period,
        "dimension": dimension,
        "value": value,
        "passed": verdict == "ok",
        "verdict": verdict,
        "expectedRows": expected,
        "rejectedRows": rejected,
        "detail": (
            f"{rejected} of {expected} order lines found no currencyexchange row "
            f"for (FromCurrency, ToCurrency='USD', order date)."
        ),
        "plainLanguage": _plain_language(scope_label, rejected, expected, verdict),
    }
