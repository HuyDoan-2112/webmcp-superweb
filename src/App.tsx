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

function InternalShell() {
  const view = useStore((s) => s.view);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header fixed>
          <PeriodBar />
        </Header>
        <Main fixed>
          {view === "dashboard" && <Dashboard />}
          {view === "report" && <Report />}
          {view === "lineage" && <Lineage />}
        </Main>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
