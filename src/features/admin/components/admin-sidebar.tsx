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
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin",               icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/companies",     icon: Building2,       label: "Empresas" },
  { href: "/admin/users",         icon: Users,           label: "Usuários" },
  { href: "/admin/roles",         icon: UserCog,         label: "Funções" },
  { href: "/admin/permissions",   icon: Lock,            label: "Permissões" },
  { href: "/admin/stars",         icon: Star,            label: "Stars" },
  { href: "/admin/plans",         icon: CreditCard,      label: "Planos" },
  { href: "/admin/instances",     icon: Wifi,            label: "Instâncias" },
  { href: "/admin/apps",          icon: Puzzle,          label: "Apps" },
  { href: "/admin/notifications",  icon: Bell,            label: "Notificações"  },
  { href: "/admin/space-points",   icon: Rocket,          label: "Space Points"  },
  { href: "/admin/assets",         icon: ImageIcon,       label: "Padrão Visual" },
  { href: "/admin/payments",       icon: Landmark,        label: "Gateways"      },
  { href: "/admin/moderators",     icon: ShieldCheck,     label: "Moderadores"   },
  { href: "/admin/atalhos",        icon: Keyboard,        label: "Atalhos"        },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-800 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-violet-400" />
        <span className="text-sm font-bold text-white tracking-wide">NASA Admin</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-violet-600/20 text-violet-300"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-zinc-800">
        <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Painel Restrito</p>
      </div>
    </aside>
  );
}
