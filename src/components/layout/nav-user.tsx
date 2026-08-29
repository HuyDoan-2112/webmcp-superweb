import { ChevronsUpDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { getDisplayNameInitials } from "@/lib/utils";
import { setSurface } from "@/store";

// Placeholder until src/auth/users.ts is written. The demo session is identity,
// not security - see docs/PLAN.md section 6.
const DEMO_USERS = [
  { name: "Maya Okonkwo", role: "Operations" },
  { name: "Priya Raman", role: "Data Science" },
  { name: "Tom Alvarez", role: "Data Platform" },
];

export function NavUser() {
  const { isMobile } = useSidebar();
  const user = DEMO_USERS[0];

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {getDisplayNameInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs">{user.role}</span>
              </div>
              <ChevronsUpDown className="ms-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Signed in as
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {DEMO_USERS.map((u) => (
              <DropdownMenuItem key={u.name}>
                <div className="grid text-sm leading-tight">
                  <span>{u.name}</span>
                  <span className="text-muted-foreground text-xs">{u.role}</span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {/* The way back to the public catalogue. Signing out drops the
                internal tool set and leaves the small public one. */}
            <DropdownMenuItem onClick={() => setSurface("public")}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
