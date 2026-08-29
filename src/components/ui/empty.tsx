// Empty state primitive, following the shadcn/ui `Empty` API (MIT), the same
// provenance as the rest of this folder. Written here rather than pulled from
// a community registry so the licence is not in question.
//
// Composition: Empty > EmptyMedia + EmptyTitle + EmptyDescription + EmptyContent.

import { cn } from "@/lib/utils";

export function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-6 py-16 text-center",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-media"
      className={cn(
        "bg-muted text-muted-foreground mb-4 flex size-11 items-center justify-center rounded-lg [&_svg]:size-5",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-title"
      className={cn("text-sm font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

export function EmptyDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-description"
      className={cn(
        "text-muted-foreground max-w-sm text-sm text-balance",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn("mt-5 flex items-center gap-2", className)}
      {...props}
    />
  );
}
