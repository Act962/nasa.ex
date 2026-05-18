"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import {
  Building2,
  Package,
  Tags,
  Settings2,
  Boxes,
  Users,
  Receipt,
  LayoutDashboard,
  PlugZap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/nerp", label: "Visão geral", icon: PlugZap },
  { href: "/nerp/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/nerp/org", label: "Organização", icon: Building2 },
  { href: "/nerp/products", label: "Produtos", icon: Package },
  { href: "/nerp/categories", label: "Categorias", icon: Tags },
  { href: "/nerp/catalog-settings", label: "Catálogo", icon: Settings2 },
  { href: "/nerp/stocks", label: "Estoque", icon: Boxes },
  { href: "/nerp/customer", label: "Clientes", icon: Users },
  { href: "/nerp/sales", label: "Vendas", icon: Receipt },
];

export function NerpShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-1 border-b pb-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/nerp" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>

      <div>{children}</div>
    </div>
  );
}
