"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  FileBarChart2,
  BarChart3,
  Route,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STORAGE_KEY = "insights-sidebar-collapsed";

const navItems = [
  { label: "Visão Geral", href: "/insights", icon: LayoutDashboard, exact: true },
  { label: "Jornada do Lead", href: "/insights/jornada", icon: Route },
  { label: "Atividades", href: "/insights/atividades", icon: Activity },
  { label: "Relatórios Completos", href: "/insights/relatorios-completos", icon: BarChart3 },
  { label: "Relatórios", href: "/insights/relatorios", icon: FileBarChart2 },
];

interface InsightsSidebarProps {
  /**
   * Slot pra botões de ação (Compartilhar, Atualizar, etc.) — só aparece
   * quando faz sentido (ex: na página principal do dashboard). Cada child
   * deve ser um botão com tooltip e ícone único.
   */
  actions?: ReactNode;
}

export function InsightsSidebar({ actions }: InsightsSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hidrata o estado do localStorage só no client pra evitar mismatch SSR.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "h-full flex flex-col border-r bg-background/95 backdrop-blur-sm shrink-0 transition-[width] duration-200",
          collapsed ? "w-14" : "w-56",
        )}
      >
        {/* Header: toggle de retrair */}
        <div className="flex items-center justify-between px-2 py-3 border-b">
          {!collapsed && (
            <span className="text-sm font-semibold px-2">Insights</span>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "flex items-center justify-center size-7 rounded-md hover:bg-muted text-muted-foreground transition-colors",
              collapsed && "mx-auto",
            )}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            const link = (
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );

            if (!mounted || !collapsed) return <div key={item.href}>{link}</div>;
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Action buttons (Compartilhar, Atualizar, etc.) */}
        {actions && (
          <div
            className={cn(
              "border-t p-2 flex gap-1.5",
              collapsed ? "flex-col items-center" : "flex-wrap",
            )}
            data-sidebar-collapsed={collapsed ? "true" : "false"}
          >
            {actions}
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
