"use client";

import Link from "next/link";
import {
  Building2,
  Package,
  Tags,
  Settings2,
  Boxes,
  Users,
  Receipt,
  LayoutDashboard,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NerpConnectCard } from "@/features/nerp/components/nerp-connect-card";
import { NerpShell } from "../../../../features/nerp/components/nerp-shell";
import { useNerpConnection } from "@/features/nerp/hooks/use-nerp-connection";

const DOMAINS = [
  { href: "/nerp/dashboard", label: "Dashboard", desc: "Métricas e overview", icon: LayoutDashboard },
  { href: "/nerp/org", label: "Organização", desc: "Dados da org nerp", icon: Building2 },
  { href: "/nerp/products", label: "Produtos", desc: "CRUD de catálogo", icon: Package },
  { href: "/nerp/categories", label: "Categorias", desc: "Hierarquia de produtos", icon: Tags },
  { href: "/nerp/catalog-settings", label: "Catálogo", desc: "Configurações gerais", icon: Settings2 },
  { href: "/nerp/stocks", label: "Estoque", desc: "Movimentações", icon: Boxes },
  { href: "/nerp/customer", label: "Clientes", desc: "CRUD de clientes", icon: Users },
  { href: "/nerp/sales", label: "Vendas", desc: "Listar e criar", icon: Receipt },
];

export default function NerpHubPage() {
  const conn = useNerpConnection();

  return (
    <NerpShell
      title="nerp · ERP"
      description="Gerencie produtos, vendas, clientes e dashboards do seu ERP direto do NASA."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {conn.connected && conn.isActive ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DOMAINS.map(({ href, label, desc, icon: Icon }) => (
                <Link key={href} href={href}>
                  <Card className="h-full transition-colors hover:bg-muted/50">
                    <CardHeader className="space-y-1">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Icon className="size-4" />
                        {label}
                      </CardTitle>
                      <CardDescription className="text-xs">{desc}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Conecte primeiro</CardTitle>
                <CardDescription>
                  Após conectar, os domínios do nerp aparecem aqui pra navegação.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Use o card ao lado pra iniciar o fluxo de consentimento.
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <NerpConnectCard />
        </div>
      </div>
    </NerpShell>
  );
}
