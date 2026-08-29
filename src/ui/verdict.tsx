import { Badge } from "@/components/ui/badge";

// Mirrors TrustVerdict in shared/types.ts once that file is written.
// Three values, not two - see docs/adr/0002-trust-verdict-has-three-values.md.
export type Verdict = "ok" | "degraded" | "blocked";

const LABEL: Record<Verdict, string> = {
  ok: "Verified",
  degraded: "Gap noted",
  blocked: "Blocked",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  if (verdict === "ok") {
    return (
      <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
        {LABEL.ok}
      </Badge>
    );
  }
  if (verdict === "degraded") {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-600">
        {LABEL.degraded}
      </Badge>
    );
  }
  return <Badge variant="destructive">{LABEL.blocked}</Badge>;
}
