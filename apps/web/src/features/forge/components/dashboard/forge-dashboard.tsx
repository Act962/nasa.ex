"use client";

import { useForgeDashboard } from "../../hooks/use-forge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  FileCheck2,
  DollarSign,
  CreditCard,
  TrendingUp,
  Calendar,
  User,
  Eye,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmt(value: string | number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  RASCUNHO:   { label: "Rascunho",   color: "bg-gray-100 text-gray-600" },
  ENVIADA:    { label: "Enviada",    color: "bg-blue-100 text-blue-600" },
  VISUALIZADA:{ label: "Visualizada",color: "bg-yellow-100 text-yellow-600" },
  PAGA:       { label: "Paga",       color: "bg-emerald-100 text-emerald-700" },
  EXPIRADA:   { label: "Expirada",   color: "bg-red-100 text-red-600" },
  CANCELADA:  { label: "Cancelada",  color: "bg-red-50 text-red-400" },
};

function KpiCard({
  title, value, icon: Icon, color,
}: { title: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("p-2 rounded-lg", color)}>
          <Icon className="size-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function calcTotal(proposal: { products: { quantity: string; unitValue: string; discount: string | null }[]; discount: string | null; discountType: string | null }) {
  let subtotal = 0;
  for (const pp of proposal.products) {
    subtotal += Number(pp.quantity) * Number(pp.unitValue) - Number(pp.discount ?? 0);
  }
  if (proposal.discount) {
    const d = Number(proposal.discount);
    subtotal = proposal.discountType === "PERCENTUAL" ? subtotal * (1 - d / 100) : subtotal - d;
  }
  return subtotal;
}

export function ForgeDashboard() {
  const { data, isLoading } = useForgeDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-7 w-20" /></CardContent></Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const kpis = [
    { title: "Propostas Enviadas",        value: String(data.proposalsSent),      icon: FileText,   color: "bg-[#7C3AED]" },
    { title: "Contratos Ativos",           value: String(data.activeContracts),    icon: FileCheck2, color: "bg-emerald-600" },
    { title: "Valor Gerado em Propostas",  value: fmt(data.totalProposalValue),    icon: DollarSign, color: "bg-blue-600" },
    { title: "Propostas Pagas",            value: String(data.proposalsPaid),      icon: CreditCard, color: "bg-amber-600" },
    { title: "Comissões Geradas",          value: fmt(data.commissionsGenerated),  icon: TrendingUp, color: "bg-rose-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => <KpiCard key={k.title} {...k} />)}
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Propostas Recentes</h2>
        {data.recentProposals.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Nenhuma proposta ainda.</CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.recentProposals.map((p: {
              id: string; number: number; title: string; status: string;
              validUntil: Date | null; createdAt: Date;
              client: { name: string } | null;
              responsible: { name: string };
              products: { quantity: string; unitValue: string; discount: string | null }[];
              discount: string | null; discountType: string | null;
            }) => {
              const st = STATUS_LABELS[p.status] ?? { label: p.status, color: "bg-gray-100 text-gray-600" };
              return (
                <Card key={p.id} className="border hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-mono">#{String(p.number).padStart(4, "0")}</p>
                        <p className="font-semibold text-sm leading-tight mt-0.5 line-clamp-1">{p.title}</p>
                      </div>
                      <Badge className={cn("text-[10px] shrink-0", st.color)}>{st.label}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="size-3 shrink-0" />
                      <span className="truncate">{p.client?.name ?? "—"}</span>
                    </div>
                    {p.validUntil && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="size-3 shrink-0" />
                        <span>Válida até {new Date(p.validUntil).toLocaleDateString("pt-BR")}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t">
                      <span className="text-sm font-bold text-[#7C3AED]">{fmt(calcTotal(p))}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
