"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutTemplate, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/campanhas", label: "Campanhas", icon: Send, exact: true },
  { href: "/campanhas/templates", label: "Modelos", icon: LayoutTemplate, exact: false },
] as const;

/** Navegação entre as áreas do app de Campanhas (disparos e modelos). */
export function CampanhasNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" /> {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
