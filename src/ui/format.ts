import type { MetricUnit } from "@shared/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});
const count = new Intl.NumberFormat("en-US");
const ratio = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function formatMetric(value: number, unit: MetricUnit): string {
  if (unit === "currency") return currency.format(value);
  if (unit === "ratio") return ratio.format(value);
  return count.format(Math.round(value));
}

export function formatExact(value: number, unit: MetricUnit): string {
  if (unit === "currency")
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  if (unit === "ratio") return ratio.format(value);
  return count.format(Math.round(value));
}
