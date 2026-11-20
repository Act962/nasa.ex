"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePanelPath } from "@/features/trafego/lib/base-path";

/** Troca entre os pedidos do trafeGO e a conta de anúncios inteira. Some no preview, que não lê conta real. */
export function PanelViewTabs({ active, className }: { active: "orders" | "account"; className?: string }) {
  const panelPath = usePanelPath();
  if (panelPath !== "/trafego/painel") return null;

  const tabs = [
    { key: "orders", label: "Pedidos do trafeGO", shortLabel: "Pedidos", href: panelPath },
    { key: "account", label: "Toda a conta de anúncios", shortLabel: "Conta inteira", href: `${panelPath}/conta` },
  ] as const;

  return (
    <nav aria-label="Visão do painel" className={cn("flex gap-1 rounded-full bg-muted p-1 md:w-fit", className)}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn(
            "flex h-9 flex-1 items-center justify-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition md:flex-none",
            active === tab.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="md:hidden">{tab.shortLabel}</span>
          <span className="max-md:hidden">{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
