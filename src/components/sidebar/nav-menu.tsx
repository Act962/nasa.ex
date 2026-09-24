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
import { SIDEBAR_NAV_ITEMS, SCOPED_NAV_KEYS } from "@/features/apps/lib/sidebar-items";
import {
  useSidebarPrefs,
  useSidebarScope,
  isItemVisible,
} from "@/hooks/use-sidebar-prefs";

/**
 * No modo recolhido o botão vira coluna: ícone em cima, nome embaixo em
 * corpo menor. Só o ícone deixava o menu ilegível para quem não decorou a
 * simbologia. O nome trunca porque a faixa recolhida é estreita de
 * propósito — "Formulários" vira "Formulá…" e o tooltip mostra o resto.
 */
const ICON_MODE_BUTTON =
  "group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:h-auto! group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-0.5 group-data-[collapsible=icon]:px-1! group-data-[collapsible=icon]:py-1.5!";

const ICON_MODE_LABEL =
  "group-data-[collapsible=icon]:block group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:truncate group-data-[collapsible=icon]:text-center group-data-[collapsible=icon]:text-[9px] group-data-[collapsible=icon]:leading-none";

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
  const { data: scope } = useSidebarScope();

  // Org com escopo de produto vê só os apps daquele escopo — inclusive itens
  // `alwaysVisible`, que aqui são deliberadamente ignorados.
  const scopedKeys = scope?.appScope ? SCOPED_NAV_KEYS[scope.appScope] : undefined;

  const visibleItems = scopedKeys
    ? SIDEBAR_NAV_ITEMS.filter((item) => scopedKeys.includes(item.key))
    : SIDEBAR_NAV_ITEMS.filter(
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
              ICON_MODE_BUTTON,
              pathname === "/home" &&
                "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            {/* `home=1` evita o redirect pro app principal — o Início continua
                acessível mesmo com outro app definido como inicial. */}
            <Link href="/home?home=1">
              <AstroNavIcon />
              <span className={ICON_MODE_LABEL}>Início</span>
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
                  ICON_MODE_BUTTON,
                  isActive &&
                    "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                <Link href={item.url}>
                  <Icon />
                  <span className={ICON_MODE_LABEL}>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
