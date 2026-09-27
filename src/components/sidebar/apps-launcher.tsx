"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ExternalLink, LayoutGrid } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { APPS } from "@/features/apps/components/apps-data";
import { SIDEBAR_NAV_ITEMS } from "@/features/apps/lib/sidebar-items";
import { useSidebarPrefs, isItemVisible } from "@/hooks/use-sidebar-prefs";
import { ICON_MODE_BUTTON, ICON_MODE_LABEL } from "./icon-mode";

/**
 * "Apps" do menu lateral: abre um segundo menu ao lado, com todos os apps em
 * duas colunas (ícone + nome). Com muitos apps, isso evita que o menu
 * principal vire uma lista longa que não cabe na tela.
 */

/** Apps que dá para abrir direto — os de modal/sem rota ficam na página /apps. */
const LAUNCHABLE_APPS = APPS.filter(
  (app) => !app.hidden && app.href && (app.action === "internal" || app.action === "external"),
);

export function AppsLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { data: prefs } = useSidebarPrefs();
  const isActive = pathname === "/apps" || pathname.startsWith("/apps/");

  // App que já está na faixa ao lado não se repete aqui: o painel existe para
  // alcançar o que NÃO está no menu. Some do painel quando entra no menu, e
  // volta quando sai — a lista se ajusta sozinha.
  const apps = LAUNCHABLE_APPS.filter((app) => {
    const navItem = app.sidebarKey
      ? SIDEBAR_NAV_ITEMS.find((item) => item.key === app.sidebarKey)
      : undefined;
    if (!navItem) return true;
    return !(
      navItem.alwaysVisible ||
      isItemVisible(prefs, `app:${navItem.key}`, navItem.defaultVisible)
    );
  });

  return (
    <SidebarMenuItem>
      <Popover open={open} onOpenChange={setOpen}>
        {/* Sem `tooltip`: ele embrulha o botão e o Popover perde a âncora. */}
        <PopoverTrigger asChild>
          <SidebarMenuButton
            aria-label="Apps"
            className={cn(
              ICON_MODE_BUTTON,
              (isActive || open) && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <LayoutGrid />
            <span className={ICON_MODE_LABEL}>Apps</span>
          </SidebarMenuButton>
        </PopoverTrigger>

        {/* Altura cheia, como a faixa do menu ao lado: com muitos apps, um
            popover curto obrigava a rolar dentro de uma caixinha. */}
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          collisionPadding={0}
          className="flex h-dvh w-[15rem] max-w-[calc(100vw-5rem)] flex-col rounded-none border-y-0 p-2"
        >
          <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Apps do ÓRBITA
          </p>

          <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
            {apps.map((app) => {
              // Ícone de traço, igual ao do menu lateral: a arte colorida é do card.
              const Icon = app.lineIcon;
              const isExternal = app.action === "external";
              const isCurrent =
                !isExternal &&
                app.href !== undefined &&
                (pathname === app.href || pathname.startsWith(`${app.href}/`));

              return (
                <Link
                  key={app.id}
                  href={app.href!}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent",
                    isCurrent && "bg-accent",
                  )}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{app.name}</span>
                  {isExternal && <ExternalLink className="size-3 shrink-0 text-muted-foreground" />}
                </Link>
              );
            })}
          </div>

          <Link
            href="/apps"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center justify-between rounded-lg border-t px-2 pb-1 pt-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver todos e personalizar o menu
            <ArrowRight className="size-3.5" />
          </Link>
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  );
}
