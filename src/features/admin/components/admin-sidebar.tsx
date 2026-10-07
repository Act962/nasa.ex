"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Star,
  CreditCard,
  Users,
  ShieldCheck,
  UserCog,
  Lock,
  Wifi,
  Puzzle,
  Bell,
  Rocket,
  ImageIcon,
  Landmark,
  Keyboard,
  LifeBuoyIcon,
  LayoutTemplate,
  Globe,
  Handshake,
  GraduationCap,
  TrendingUp,
  BrainCircuit,
  MessageSquareWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/companies", icon: Building2, label: "Empresas" },
  { href: "/admin/users", icon: Users, label: "Usuários" },
  { href: "/admin/roles", icon: UserCog, label: "Funções" },
  { href: "/admin/permissions", icon: Lock, label: "Permissões" },
  { href: "/admin/stars", icon: Star, label: "Stars" },
  { href: "/admin/ai-credits", icon: BrainCircuit, label: "Créditos de IA" },
  { href: "/admin/plans", icon: CreditCard, label: "Planos" },
  { href: "/admin/instances", icon: Wifi, label: "Instâncias" },
  { href: "/admin/apps", icon: Puzzle, label: "Apps" },
  { href: "/admin/notifications", icon: Bell, label: "Notificações" },
  { href: "/admin/space-points", icon: Rocket, label: "Space Points" },
  { href: "/admin/assets", icon: ImageIcon, label: "Padrão Visual" },
  { href: "/admin/payments", icon: Landmark, label: "Gateways" },
  { href: "/admin/partners", icon: Handshake, label: "Parceiros" },
  { href: "/admin/moderators", icon: ShieldCheck, label: "Moderadores" },
  { href: "/admin/patterns", icon: LayoutTemplate, label: "Padrões ÓRBITA" },
  { href: "/admin/space-help", icon: GraduationCap, label: "Space Help" },
  { href: "/admin/space_station", icon: Globe, label: "Space Station" },
  { href: "/admin/atalhos", icon: Keyboard, label: "Atalhos" },
  { href: "/admin/trafego", icon: TrendingUp, label: "trafeGO" },
  { href: "/admin/support", icon: LifeBuoyIcon, label: "Suporte" },
  { href: "/admin/astro-correcoes", icon: MessageSquareWarning, label: "Correções do ASTRO" },
];

export function AdminSidebar({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className={cn("w-56 shrink-0 bg-card border-r border-line flex flex-col", className)}>
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-foreground" />
        <span className="text-sm font-bold text-foreground tracking-wide">
          ÓRBITA Admin
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active =
            href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
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

      {/* Footer */}
      <div className="px-4 py-4">
        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">
          Painel Restrito
        </p>
      </div>
    </aside>
  );
}
