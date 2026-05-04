"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Activity, FileBarChart2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Visão Geral",         href: "/insights",                      icon: LayoutDashboard },
  { label: "Atividades",          href: "/insights/atividades",           icon: Activity        },
  { label: "Relatórios completos", href: "/insights/relatorios-completos", icon: BarChart3      },
  { label: "Relatórios",          href: "/insights/relatorios",           icon: FileBarChart2   },
];

export function InsightsTabsNav() {
  const pathname = usePathname();

  return (
    <div className="border-b bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-1 px-4 sm:px-6 max-w-7xl mx-auto overflow-x-auto">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/insights"
              ? pathname === "/insights"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                "hover:text-foreground",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
              {isActive && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
