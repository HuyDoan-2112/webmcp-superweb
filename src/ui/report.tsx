import { AlertTriangle, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { approveReport } from "@/store";
import { fetchMetric, fetchTrust } from "@/api";
import { useAsync } from "@/hooks/use-async";
import { useStore } from "@/hooks/use-store";
import { VerdictBadge } from "@/ui/verdict";
import { formatExact } from "@/ui/format";

/**
 * The sections a revenue report is cut into.
 *
 * Scoped by store country rather than by customer continent. Continent puts the
 * United Kingdom in Europe, which mixes clean sterling revenue into the broken
 * euro slice and turns a clean block into an ambiguous partial one.
 *
 * This is every country the pipeline recorded a check for, which is the same
 * list draft_report's defaultSections builds from the check file. The page
 * preview and the drafted report have to agree: a preview missing Online would
 * never show the degraded verdict, and one missing France, Italy and the
 * Netherlands would show a single blocked country where there are four.
 */
const SECTIONS = [
  { heading: "United States", filters: { country: "United States" } },
  { heading: "Canada", filters: { country: "Canada" } },
  { heading: "United Kingdom", filters: { country: "United Kingdom" } },
  { heading: "Australia", filters: { country: "Australia" } },
  { heading: "Online", filters: { country: "Online" } },
  { heading: "France", filters: { country: "France" } },
  { heading: "Germany", filters: { country: "Germany" } },
  { heading: "Italy", filters: { country: "Italy" } },
  { heading: "Netherlands", filters: { country: "Netherlands" } },
] as const;

export function Report() {
  const period = useStore((s) => s.period);
  const metricId = useStore((s) => s.metricId);
  const drafted = useStore((s) => s.reportSections);
  const approved = useStore((s) => s.reportApproved);

  const { data, loading } = useAsync(
    () =>
      Promise.all(
        SECTIONS.map(async (section) => {
          // Two calls per section, in the order draft_report makes them: what
          // the number is, then whether it has earned publication.
          const [result, trust] = await Promise.all([
            fetchMetric({ metric: metricId as never, period, filters: section.filters }),
            fetchTrust({ metric: metricId as never, period, filters: section.filters }),
          ]);
          return { section, result, trust };
        }),
      ),
    [period, metricId],
  );

  // Once draft_report has written into the store, the page renders what the
  // agent committed rather than its own preview. That handover is the demo: the
  // agent's work stops being a chat reply and becomes the document.
  const sections =
    drafted.length > 0
      ? drafted
      : (data ?? []).map(({ section, result, trust }) => ({
          heading: section.heading,
          verdict: trust.verdict,
          body:
            trust.verdict === "blocked" || trust.verdict === "unchecked"
              ? (trust.plainLanguage ?? "")
              : // `?? 0` used to live in the template below. /api/query now
                // returns no row rather than a zero when a slice has none, so
                // the fallback would have printed a figure of nothing.
                result.rows.length === 0
                ? "No figure is available for this section."
                : `${trust.metricLabel} of ${formatExact(result.rows[0].value, result.unit)}` +
                (result.rows[0].delta === undefined
                  ? "."
                  : `, ${result.rows[0].delta >= 0 ? "up" : "down"} ${Math.abs(
                      result.rows[0].delta * 100,
                    ).toFixed(1)}% on the prior period.`) +
                (trust.verdict === "degraded" && trust.plainLanguage
                  ? ` ${trust.plainLanguage}`
                  : ""),
        }));

  const blocked = sections.filter((s) => s.verdict === "blocked");
  const showSkeleton = drafted.length === 0 && (loading || !data);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Revenue report</h1>
        <p className="text-muted-foreground text-sm">
          {period} · Prepared by Maya Okonkwo · Kestrel Supply Co.
        </p>
      </div>

      {/*
        The approval step. The agent decides what may be written, and this
        decides whether it may be sent. build_deck reads the same flag and
        refuses while it is false, so the button is the only way out of the
        page. There is no tool behind it on purpose: a draft an agent can
        approve on its own has not been approved by anyone.
      */}
      {drafted.length > 0 && (
        <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div className="text-sm">
            <p className="font-medium">
              {approved ? "Approved for export" : "Agent draft, awaiting your review"}
            </p>
            <p className="text-muted-foreground">
              {approved
                ? "build_deck can now read these sections. Redrafting sends it back for review."
                : `Read the ${blocked.length} refused section${
                    blocked.length === 1 ? "" : "s"
                  } and any warning below before approving. Nothing leaves this page until you do.`}
            </p>
          </div>
          <Button size="sm" disabled={approved} onClick={approveReport}>
            {approved ? <Check /> : null}
            {approved ? "Approved" : "Approve for export"}
          </Button>
        </div>
      )}

      {blocked.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            {blocked.length} section{blocked.length === 1 ? "" : "s"} could not be published
          </AlertTitle>
          <AlertDescription>{blocked[0].body}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sections</CardTitle>
          <CardDescription>
            {showSkeleton
              ? "Checking each section"
              : `${sections.length - blocked.length} of ${sections.length} drafted` +
                (drafted.length > 0 ? " by the agent" : "")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {showSkeleton
            ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)
            : sections.map((section, i) => (
                <div key={`${section.heading}-${i}`} className="flex flex-col gap-2">
                  {i > 0 && <Separator className="mb-2" />}
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold">{section.heading}</h2>
                    <VerdictBadge verdict={section.verdict} />
                  </div>
                  {section.verdict === "blocked" ? (
                    <p className="text-muted-foreground text-sm italic">
                      No number written. {section.body}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm">{section.body}</p>
                  )}
                </div>
              ))}
        </CardContent>
      </Card>
    </div>
  );
}
