import { BarChart3, FileText, GitBranch, Bird } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useStore } from "@/hooks/use-store";
import { setView, type Audience, type View } from "@/store";
import { NavUser } from "./nav-user";

const NAV: { view: View; title: string; icon: typeof BarChart3 }[] = [
  { view: "dashboard", title: "Dashboard", icon: BarChart3 },
  { view: "report", title: "Report", icon: FileText },
  { view: "lineage", title: "Lineage", icon: GitBranch },
];

/**
 * The view each person opens on, and the one their sidebar leads with.
 *
 * Nothing is hidden. Operations can still reach the lineage ladder and the
 * engineer can still read the report, which matters because trace_lineage moves
 * the page to the lineage view and a nav that had dropped it would leave the
 * agent pointing at a page the person cannot see. What changes is the order and
 * where you land, so two people signing into the same origin get visibly
 * different work rather than the same three tabs.
 */
const HOME: Record<Audience, View> = {
  public: "dashboard",
  ops: "report",
  analyst: "dashboard",
  engineer: "lineage",
};

function navFor(audience: Audience | null): typeof NAV {
  if (audience === null) return NAV;
  const home = HOME[audience];
  return [...NAV].sort((a, b) =>
    a.view === home ? -1 : b.view === home ? 1 : 0,
  );
}

export function AppSidebar() {
  const view = useStore((s) => s.view);
  const audience = useStore((s) => s.audience);
  const nav = navFor(audience);

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default">
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Bird className="size-4" />
              </div>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">Kestrel Supply Co.</span>
                <span className="truncate text-xs">SuperWeb</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Analysis</SidebarGroupLabel>
          <SidebarMenu>
            {nav.map((item) => (
              <SidebarMenuItem key={item.view}>
                <SidebarMenuButton
                  isActive={view === item.view}
                  tooltip={item.title}
                  onClick={() => setView(item.view)}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
