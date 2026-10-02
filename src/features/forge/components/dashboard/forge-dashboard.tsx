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
  RASCUNHO:   { label: "Rascunho",   color: "bg-muted text-muted-foreground" },
  ENVIADA:    { label: "Enviada",    color: "bg-info/15 text-info" },
  VISUALIZADA:{ label: "Visualizada",color: "bg-warning/15 text-warning" },
  PAGA:       { label: "Paga",       color: "bg-success/15 text-success" },
  EXPIRADA:   { label: "Expirada",   color: "bg-destructive/15 text-destructive" },
  CANCELADA:  { label: "Cancelada",  color: "bg-destructive/10 text-destructive" },
};

function KpiCard({
  title, value, icon: Icon, color,
}: { title: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <Card className="gap-2 py-4 max-sm:gap-1.5 max-sm:py-3">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0 max-sm:px-3">
        <CardTitle className="text-sm leading-tight font-medium text-muted-foreground max-sm:text-[12px]">{title}</CardTitle>
        <div className={cn("grid size-8 shrink-0 place-items-center rounded-full max-sm:size-7", color)}>
          <Icon className="size-4 text-white max-sm:size-3.5" />
        </div>
      </CardHeader>
      <CardContent className="max-sm:px-3">
        <p className="truncate text-2xl font-bold tabular-nums max-sm:text-lg">{value}</p>
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
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-5">
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
    { title: "Propostas Enviadas",        value: String(data.proposalsSent),      icon: FileText,   color: "bg-info" },
    { title: "Contratos Ativos",           value: String(data.activeContracts),    icon: FileCheck2, color: "bg-success" },
    { title: "Valor Gerado em Propostas",  value: fmt(data.totalProposalValue),    icon: DollarSign, color: "bg-info" },
    { title: "Propostas Pagas",            value: String(data.proposalsPaid),      icon: CreditCard, color: "bg-warning" },
    { title: "Comissões Geradas",          value: fmt(data.commissionsGenerated),  icon: TrendingUp, color: "bg-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => <KpiCard key={k.title} {...k} />)}
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Propostas Recentes</h2>
        {data.recentProposals.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Nenhuma proposta ainda.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {data.recentProposals.map((p: {
              id: string; number: number; title: string; status: string;
              validUntil: Date | null; createdAt: Date;
              client: { name: string } | null;
              responsible: { name: string };
              products: { quantity: string; unitValue: string; discount: string | null }[];
              discount: string | null; discountType: string | null;
            }) => {
              const st = STATUS_LABELS[p.status] ?? { label: p.status, color: "bg-muted text-muted-foreground" };
              return (
                <Card key={p.id} className="border py-0 transition-shadow hover:shadow-md">
                  <CardContent className="space-y-2 p-3 md:space-y-3 md:p-4">
                    <div className="flex flex-col-reverse items-start gap-1.5 md:flex-row md:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground font-mono">#{String(p.number).padStart(4, "0")}</p>
                        <p className="mt-0.5 line-clamp-2 text-sm leading-tight font-semibold md:line-clamp-1">{p.title}</p>
                      </div>
                      <Badge className={cn("shrink-0 rounded-full text-[10px]", st.color)}>{st.label}</Badge>
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
                    <div className="flex flex-col gap-0.5 border-t pt-1.5 md:flex-row md:items-center md:justify-between">
                      <span className="text-sm font-bold text-info">{fmt(calcTotal(p))}</span>
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
