"use client";

import { CreditCard, ExternalLink, Gauge, Receipt, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useMetaNumberPanel } from "../../hooks/use-official-number";

const QUALITY_STYLES: Record<string, { label: string; dotClass: string }> = {
  GREEN: { label: "Alta", dotClass: "bg-emerald-500" },
  YELLOW: { label: "Média", dotClass: "bg-amber-500" },
  RED: { label: "Baixa", dotClass: "bg-red-500" },
  UNKNOWN: { label: "Sem dados", dotClass: "bg-muted-foreground" },
};

const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
  SERVICE: "Atendimento",
  MARKETING_LITE: "Marketing Lite",
};

function formatMoney(value: number, currency: string | null): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: currency ?? "BRL" });
}

/** Painel "Número e gastos" (spec 0040, RF-8). */
export function MetaNumberPanel({
  trackingId,
  className,
  onContinueSetup,
}: {
  trackingId: string;
  className?: string;
  /** Número ainda sem chaves/credenciais: oferece terminar a conexão em vez de sumir. */
  onContinueSetup?: () => void;
}) {
  const { data, isLoading, error } = useMetaNumberPanel(trackingId);

  if (isLoading) return <Skeleton className={cn("h-36 w-full rounded-xl", className)} />;
  if (error || !data || !data.phone) {
    if (!onContinueSetup) return null;
    return (
      <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4", className)}>
        <div>
          <p className="font-semibold">Seu WhatsApp oficial ainda não terminou de conectar</p>
          <p className="text-sm text-muted-foreground">Falta colar as chaves da Meta ou confirmar o número. A gente guia o resto.</p>
        </div>
        <Button size="sm" onClick={onContinueSetup}>
          Terminar conexão
        </Button>
      </div>
    );
  }

  const quality = QUALITY_STYLES[data.phone?.quality ?? "UNKNOWN"] ?? QUALITY_STYLES.UNKNOWN;
  const dailyLimit = data.limit.dailyUniqueContacts;

  return (
    <div className={cn("space-y-3 rounded-xl border p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{data.phone?.verifiedName ?? "Número oficial"}</p>
          <p className="text-sm text-muted-foreground">{data.phone?.displayNumber ?? "—"}</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
          <span className={cn("size-2 rounded-full", quality.dotClass)} /> Qualidade {quality.label}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gauge className="size-3.5" /> Limite diário
          </p>
          <p className="text-lg font-semibold">{data.limit.label}</p>
          {dailyLimit !== null && data.remainingToday !== null && (
            <p className="text-xs text-muted-foreground">
              Restam {data.remainingToday.toLocaleString("pt-BR")} contatos nas próximas 24h
            </p>
          )}
          {data.nextLimit && data.howToReachNextLimit && (
            <p className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
              <TrendingUp className="mt-0.5 size-3 shrink-0" /> Próximo: {data.nextLimit.label}. {data.howToReachNextLimit}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Receipt className="size-3.5" /> Gasto na Meta este mês
          </p>
          {data.spend.isAvailable ? (
            <>
              <p className="text-lg font-semibold">{formatMoney(data.spend.total, data.spend.currency)}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {data.spend.byCategory.slice(0, 4).map((item) => (
                  <li key={item.category} className="flex justify-between">
                    <span>
                      {CATEGORY_LABELS[item.category] ?? item.category} · {item.volume.toLocaleString("pt-BR")} msgs
                    </span>
                    <span>{formatMoney(item.cost, data.spend.currency)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">A Meta não devolveu o gasto agora.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href={data.links.paymentMethods} target="_blank" rel="noreferrer">
            <CreditCard className="size-4" /> Cartão na Meta
          </a>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={data.links.billingActivity} target="_blank" rel="noreferrer">
            <Receipt className="size-4" /> Ver fatura
          </a>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <a href={data.links.whatsappManager} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" /> WhatsApp Manager
          </a>
        </Button>
      </div>
    </div>
  );
}
