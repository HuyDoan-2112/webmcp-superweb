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
import { useStore } from "@/hooks/use-store";
import { signIn, signOut } from "@/auth/switcher";
import { DEMO_USERS } from "@/auth/users";

export function NavUser() {
  const { isMobile } = useSidebar();
  // Whoever the cookie currently names. The audience in the store is written by
  // signIn, so this follows the same value the server is answering at.
  const audience = useStore((s) => s.audience);
  const user = DEMO_USERS.find((u) => u.audience === audience) ?? DEMO_USERS[0];

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
              Answering as
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* Switching person rewrites the cookie, so the next answer comes
                back at that person's depth. Operations gets plain language,
                Data Platform gets check names and row counts. Nobody is
                refused anything. */}
            {DEMO_USERS.map((u) => (
              <DropdownMenuItem key={u.id} onClick={() => signIn(u.id)}>
                <div className="grid text-sm leading-tight">
                  <span>
                    {u.name}
                    {u.id === user.id ? " ." : ""}
                  </span>
                  <span className="text-muted-foreground text-xs">{u.role}</span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {/* The way back to the public catalogue. Signing out clears the
                cookie and drops the internal tool set. */}
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
