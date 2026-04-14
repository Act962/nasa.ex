"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  LogOut,
  Keyboard,
  PaletteIcon,
  SunIcon,
  MoonIcon,
  LaptopIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { orpc } from "@/lib/orpc";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { useTheme } from "next-themes";

const ROLE_META: Record<string, { label: string; color: string; bg: string }> =
  {
    owner: {
      label: "Master",
      color: "text-violet-700 dark:text-violet-300",
      bg: "bg-violet-100 dark:bg-violet-900/50",
    },
    admin: {
      label: "Adm",
      color: "text-blue-700 dark:text-blue-300",
      bg: "bg-blue-100 dark:bg-blue-900/50",
    },
    member: {
      label: "Single",
      color: "text-slate-600 dark:text-slate-300",
      bg: "bg-slate-100 dark:bg-slate-800",
    },
    moderador: {
      label: "Moderador",
      color: "text-orange-700 dark:text-orange-300",
      bg: "bg-orange-100 dark:bg-orange-900/50",
    },
  };

function RolePill({ role }: { role: string }) {
  const meta = ROLE_META[role];
  if (!meta) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-bold leading-none",
        meta.color,
        meta.bg,
      )}
    >
      {meta.label}
    </span>
  );
}

export function NavUser() {
  const { isMobile } = useSidebar();
  const { data: session, isPending } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { setTheme } = useTheme();
  const router = useRouter();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Resolve current user's role in active org
  const currentRole =
    (activeOrg?.members as any[])?.find(
      (m: any) => m.userId === session?.user?.id,
    )?.role ?? null;

  function getInitials(name: string): string {
    const initials = name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");

    return initials;
  }

  const hanldeLogout = async () => {
    try {
      await orpc.activity.logLogout.call({});
    } catch {
      // best-effort, don't block logout
    }
    await authClient.signOut({
      fetchOptions: {
        onRequest: () => {
          router.push("/sign-in");
        },
      },
    });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {isPending && <Skeleton className="h-8 w-full rounded-lg" />}
              {!isPending && (
                <>
                  <Avatar className="h-8 w-8 rounded-lg">
                    {session?.user.image && (
                      <AvatarImage
                        src={session.user.image}
                        alt={session.user.name}
                      />
                    )}
                    {session?.user.name && (
                      <AvatarFallback className="rounded-lg">
                        {" "}
                        {getInitials(session.user.name)}{" "}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    {session?.user.name && (
                      <div className="flex items-baseline gap-1">
                        <span className="truncate font-medium">
                          {session?.user.name}
                        </span>
                        {currentRole && (
                          <span className="mt-0.5">
                            <RolePill role={currentRole} />
                          </span>
                        )}
                      </div>
                    )}
                    {session?.user.email && (
                      <span className="truncate text-xs">
                        {session.user.email}
                      </span>
                    )}
                  </div>
                </>
              )}
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {session?.user.image && (
                    <AvatarImage
                      src={session?.user.image}
                      alt={session?.user.name}
                    />
                  )}
                  {session?.user.name && (
                    <AvatarFallback className="rounded-lg">
                      {getInitials(session?.user.name)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  {session?.user.name && (
                    <span className="truncate font-medium">
                      {session?.user.name}
                    </span>
                  )}
                  {session?.user.email && (
                    <span className="truncate text-xs">
                      {session.user.email}
                    </span>
                  )}
                  {currentRole && (
                    <span className="mt-0.5">
                      <RolePill role={currentRole} />
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => router.push("/settings")}
                className="cursor-pointer"
              >
                <BadgeCheck />
                Configurações
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => router.push("/settings/notifications")}
                className="cursor-pointer"
              >
                <Bell />
                Preferências de Notificações
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <PaletteIcon />
                  Tema
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent sideOffset={8}>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setTheme("light")}
                    >
                      <SunIcon />
                      Claro
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setTheme("dark")}
                    >
                      <MoonIcon />
                      Escuro
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setTheme("system")}
                    >
                      <LaptopIcon />
                      Sistema
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuItem
                onClick={() => setShortcutsOpen(true)}
                className="cursor-pointer"
              >
                <Keyboard />
                Atalhos
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={hanldeLogout}
              className="cursor-pointer"
            >
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </SidebarMenu>
  );
}
