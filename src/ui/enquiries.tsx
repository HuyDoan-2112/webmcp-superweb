import { MessageCircleQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { useStore } from "@/hooks/use-store";
import { markEnquiryAnswered } from "@/store";

/**
 * Every question a signed-in customer has sent, newest first.
 *
 * Plain English, matching report.tsx and the rest of the internal dashboard:
 * that shell never reads `locale`, it speaks English to whichever staff member
 * signed in, and giving this one view five languages would make it the odd
 * screen out rather than a consistent one.
 *
 * Not wired into navigation yet. `View` in src/store.ts needs an "enquiries"
 * member before src/components/layout/app-sidebar.tsx and src/App.tsx can
 * route here; see the accompanying report for the three edits that need.
 */
export function Enquiries() {
  const enquiries = useStore((s) => s.enquiries);
  const sorted = [...enquiries].sort((a, b) => b.sentUtc.localeCompare(a.sentUtc));
  const openCount = sorted.filter((e) => !e.answered).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customer enquiries</h1>
        <p className="text-muted-foreground text-sm">
          {sorted.length === 0
            ? "Nothing sent yet"
            : `${openCount} open of ${sorted.length} total`}
        </p>
      </div>

      {sorted.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <MessageCircleQuestion />
          </EmptyMedia>
          <EmptyTitle>No enquiries yet</EmptyTitle>
          <EmptyDescription>
            A question a signed-in customer sends from a product page lands
            here. Nothing is seeded: this list only ever holds what someone
            actually asked.
          </EmptyDescription>
        </Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All enquiries</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {sorted.map((enquiry, i) => (
              <div key={enquiry.id} className="flex flex-col gap-2">
                {i > 0 && <Separator className="mb-2" />}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{enquiry.customerName}</p>
                    <p className="text-muted-foreground text-xs">
                      {enquiry.productName ?? "General enquiry"} ·{" "}
                      {new Date(enquiry.sentUtc).toLocaleString()}
                    </p>
                  </div>
                  {enquiry.answered ? (
                    <Badge variant="outline">Answered</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markEnquiryAnswered(enquiry.id)}
                    >
                      Mark answered
                    </Button>
                  )}
                </div>
                <p className="text-sm">{enquiry.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
