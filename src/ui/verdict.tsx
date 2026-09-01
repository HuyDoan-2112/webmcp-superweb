import type { TrustVerdict } from "@shared/types";
import { Badge } from "@/components/ui/badge";

// Three values, not two - see docs/adr/0002-trust-verdict-has-three-values.md.
const LABEL: Record<TrustVerdict, string> = {
  ok: "Verified",
  degraded: "Gap noted",
  blocked: "Blocked",
  unchecked: "Not checked",
};

export function VerdictBadge({ verdict }: { verdict: TrustVerdict }) {
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
  // Deliberately quiet, and deliberately not the blocked red. "Nobody looked"
  // is a different statement from "we looked and it failed", and painting them
  // the same colour would hide which one the reader is being told.
  if (verdict === "unchecked") {
    return (
      <Badge variant="outline" className="text-muted-foreground border-dashed">
        {LABEL.unchecked}
      </Badge>
    );
  }
  return <Badge variant="destructive">{LABEL.blocked}</Badge>;
}
