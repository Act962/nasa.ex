"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  History,
  Handshake,
  LifeBuoy,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/partner", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/partner/indicacoes", icon: Users, label: "Indicações" },
  { href: "/partner/comissoes", icon: TrendingUp, label: "Comissões" },
  { href: "/partner/historico-tier", icon: History, label: "Histórico de Níveis" },
  { href: "/partner/aceitar-termos", icon: ScrollText, label: "Termos" },
  { href: "/partner/suporte", icon: LifeBuoy, label: "Suporte" },
];

export function PartnerSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-card border-r border-line flex flex-col">
      <div className="px-5 py-5 flex items-center gap-2">
        <Handshake className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm font-bold text-foreground tracking-wide">
          ÓRBITA Partner
        </span>
      </div>

      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active =
            href === "/partner"
              ? pathname === "/partner"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4">
        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">
          Programa de Parceiros
        </p>
      </div>
    </aside>
  );
}
