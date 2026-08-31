import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { PeriodBar } from "@/components/layout/period-bar";
import { useStore } from "@/hooks/use-store";
import { Dashboard } from "@/ui/dashboard";
import { Report } from "@/ui/report";
import { Lineage } from "@/ui/lineage";
import { Enquiries } from "@/ui/enquiries";
import { PublicShell } from "@/ui/public/shell";

/**
 * One origin, two surfaces. `surface` decides which shell renders, and the same
 * flag is what the tool track reads to decide which set of WebMCP tools is
 * registered: a small public set for an anonymous visitor, the full internal
 * set once someone signs in.
 */
export function App() {
  const surface = useStore((s) => s.surface);

  if (surface === "public") return <PublicShell />;
  return <InternalShell />;
}

const TITLE: Record<string, string> = {
  dashboard: "Revenue",
  report: "Revenue report",
  lineage: "Lineage",
  enquiries: "Customer enquiries",
};

function InternalShell() {
  const view = useStore((s) => s.view);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header fixed>
          <h2 className="text-sm font-medium">{TITLE[view]}</h2>
        </Header>
        <Main fixed>
          <PeriodBar />
          {view === "dashboard" && <Dashboard />}
          {view === "report" && <Report />}
          {view === "lineage" && <Lineage />}
          {view === "enquiries" && <Enquiries />}
        </Main>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
