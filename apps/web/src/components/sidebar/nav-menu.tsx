"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SIDEBAR_NAV_ITEMS } from "@/features/apps/lib/sidebar-items";
import { useSidebarPrefs, isItemVisible } from "@/hooks/use-sidebar-prefs";

function AstroNavIcon({ className }: { className?: string }) {
  return (
    <>
      <img
        src="/icon-astro-light.svg"
        alt="Astro"
        className={cn("w-4 h-4 object-contain dark:hidden", className)}
      />
      <img
        src="/icon-astro.svg"
        alt="Astro"
        className={cn("w-4 h-4 object-contain hidden dark:block", className)}
      />
    </>
  );
}

export function NavMenu() {
  const pathname = usePathname();
  const { data: prefs } = useSidebarPrefs();

  const visibleItems = SIDEBAR_NAV_ITEMS.filter(
    (item) =>
      item.alwaysVisible ||
      isItemVisible(prefs, `app:${item.key}`, item.defaultVisible),
  );

  // Map sidebar keys → data-tour attribute names
  const TOUR_ATTRS: Record<string, string> = {
    tracking: "nav-tracking",
    nasachat: "nav-chat",
    integrations: "nav-integrations",
    spacetime: "nav-agenda",
  };

  return (
    <SidebarGroup data-tour="sidebar-menu">
      <SidebarGroupLabel>Menu</SidebarGroupLabel>
      <SidebarMenu>
        {/* Início — always visible */}
        <SidebarMenuItem key="home">
          <SidebarMenuButton
            tooltip="Início"
            asChild
            className={cn(
              pathname === "/home" &&
                "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <Link href="/home">
              <AstroNavIcon />
              <span>Início</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {visibleItems.map((item) => {
          const isActive =
            pathname === item.url ||
            (item.url !== "/home" && pathname.startsWith(item.url + "/"));
          const Icon = item.icon as React.ElementType;
          const tourAttr = TOUR_ATTRS[item.key];

          return (
            <SidebarMenuItem
              key={item.key}
              {...(tourAttr ? { "data-tour": tourAttr } : {})}
            >
              <SidebarMenuButton
                tooltip={item.title}
                asChild
                className={cn(
                  isActive &&
                    "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                <Link href={item.url}>
                  <Icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
