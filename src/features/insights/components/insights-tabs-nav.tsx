"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Activity, FileBarChart2, BarChart3, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";

const tabs = [
  { label: "Visão Geral",          href: "/insights",                      icon: LayoutDashboard },
  { label: "Jornada do Lead",      href: "/insights/jornada",              icon: Route           },
  { label: "Atividades",           href: "/insights/atividades",           icon: Activity        },
  { label: "Relatórios completos", href: "/insights/relatorios-completos", icon: BarChart3       },
  { label: "Relatórios",           href: "/insights/relatorios",           icon: FileBarChart2   },
];

export function InsightsTabsNav() {
  const pathname = usePathname();
  const isTabActive = (href: string) => (href === "/insights" ? pathname === "/insights" : pathname.startsWith(href));
  const toDockItem = (tab: (typeof tabs)[number], label = tab.label) => ({
    label,
    href: tab.href,
    icon: <tab.icon />,
    isActive: isTabActive(tab.href),
  });
  // No celular: Visão Geral, Jornada, Atividades e Relatórios no dock; a barra segue com todas.
  useRegisterOrbitDock({
    leftItems: [toDockItem(tabs[0], "Visão geral"), toDockItem(tabs[1], "Jornada")],
    rightItems: [toDockItem(tabs[2]), toDockItem(tabs[4])],
  });

  return (
    <div className="bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-1 px-4 py-1.5 sm:px-6 max-w-7xl mx-auto overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = isTabActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                "hover:text-foreground",
                isActive
                  ? "bg-knob text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
