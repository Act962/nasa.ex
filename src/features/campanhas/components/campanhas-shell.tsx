"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutTemplate, Megaphone, Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shell do app de Campanhas: navegação lateral (rail) no desktop + barra
 * horizontal rolável no mobile. Envolve o conteúdo de todas as telas do app
 * pra dar uma navegação única e consistente (Campanhas / Modelos / Contatos /
 * Analytics).
 */

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
}

const NAV: NavItem[] = [
  {
    href: "/campanhas/templates",
    label: "Modelos",
    description: "Templates aprovados",
    icon: LayoutTemplate,
    match: (path) => path.startsWith("/campanhas/templates"),
  },
  {
    href: "/campanhas/contatos",
    label: "Contatos",
    description: "Base unificada",
    icon: Users,
    match: (path) => path.startsWith("/campanhas/contatos"),
  },
  {
    href: "/campanhas/analytics",
    label: "Analytics",
    description: "Métricas de envio",
    icon: BarChart3,
    match: (path) => path.startsWith("/campanhas/analytics"),
  },
];

// "Campanhas" (disparos) fica no topo e cobre a home + o detalhe /campanhas/<id>,
// desde que não seja uma das seções específicas acima.
const CAMPAIGNS_ITEM: NavItem = {
  href: "/campanhas",
  label: "Campanhas",
  description: "Disparos em massa",
  icon: Send,
  match: (path) =>
    path === "/campanhas" ||
    (path.startsWith("/campanhas/") && !NAV.some((item) => item.match(path))),
};

const ALL_ITEMS = [CAMPAIGNS_ITEM, ...NAV];

export function CampanhasShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)]">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/20 p-3 md:flex">
        <div className="mb-4 flex items-center gap-2.5 px-2 py-1.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Megaphone className="size-[18px]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight tracking-tight">
              Campanhas
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              WhatsApp Oficial
            </p>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          {ALL_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate leading-tight">{item.label}</span>
                  <span className="truncate text-[11px] font-normal text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <nav className="flex gap-1.5 overflow-x-auto border-b px-3 py-2 md:hidden">
          {ALL_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/** Container padrão do conteúdo de cada tela do app. */
export function CampanhasContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
