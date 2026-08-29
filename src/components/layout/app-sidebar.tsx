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
import { setView, type View } from "@/store";
import { NavUser } from "./nav-user";

const NAV: { view: View; title: string; icon: typeof BarChart3 }[] = [
  { view: "dashboard", title: "Dashboard", icon: BarChart3 },
  { view: "report", title: "Report", icon: FileText },
  { view: "lineage", title: "Lineage", icon: GitBranch },
];

export function AppSidebar() {
  const view = useStore((s) => s.view);

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
            {NAV.map((item) => (
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
