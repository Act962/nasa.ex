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
import { ICON_MODE_BUTTON, ICON_MODE_LABEL } from "./icon-mode";
import { AppsLauncher } from "./apps-launcher";
import { useUnansweredTotal } from "@/features/tracking-chat/hooks/use-unanswered-counts";

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

/** Bolinha de leads esperando resposta, no ícone do app (spec 0030, RF-7). */
function NavIconWithBadge({
  icon: Icon,
  count,
}: {
  icon: React.ElementType;
  count: number;
}) {
  // O `size-4` vai no ícone porque a regra do botão (`[&>svg]:size-4`) só
  // alcança filho direto — embrulhar para a bolinha deixava o ícone maior.
  return (
    <span className="relative flex shrink-0 items-center justify-center">
      <Icon className="size-4 shrink-0" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold leading-none text-white pointer-events-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </span>
  );
}

export function NavMenu() {
  const pathname = usePathname();
  const { total: unansweredLeads } = useUnansweredTotal();
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
          // Apps abre o painel de 2 colunas em vez de navegar direto.
          if (item.key === "apps") return <AppsLauncher key={item.key} />;

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
                  {item.key === "nasachat" ? (
                    <NavIconWithBadge icon={Icon} count={unansweredLeads} />
                  ) : (
                    <Icon />
                  )}
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
