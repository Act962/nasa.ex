"use client";

import Link from "next/link";
import { BarChart3, ExternalLink, Gauge, Receipt } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMetaNumberPanel } from "../hooks/use-official-number";
import { useActiveTrackingId } from "../hooks/use-active-tracking-id";
import { META_PRICING_CATEGORY_LABELS } from "../lib/meta-pricing-categories";

/** Barra de cima do app Campanhas: saldo do número (disponível hoje + gasto no mês) e atalho do relatório. */

function formatMoney(value: number, currency = "BRL"): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency });
}

export function CampanhasTopBar() {
  const trackingId = useActiveTrackingId();

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 bg-brand-whatsapp-deep px-3 text-white sm:px-4">
      <SidebarTrigger className="shrink-0 text-white hover:bg-white/10 hover:text-white" />
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {trackingId ? <BalanceChips trackingId={trackingId} /> : <EmptyBalanceChips />}
      </div>
      <Link
        href="/insights/campanhas"
        aria-label="Relatório das campanhas"
        title="Relatório das campanhas"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
      >
        <BarChart3 className="size-4" />
      </Link>
    </header>
  );
}

/** Sem número conectado: os mesmos campos, zerados, para o usuário já saber onde olhar. */
function EmptyBalanceChips() {
  return (
    <>
      <div className={CHIP_CLASS} title="Conecte um número oficial para liberar o envio">
        <span className="flex items-center gap-1 text-[10px] text-white/65">
          <Gauge className="size-2.5" /> Disponível hoje
        </span>
        <span className="truncate text-sm font-bold tabular-nums">0 contatos</span>
      </div>
      <div className={CHIP_CLASS} title="Nenhum gasto até conectar um número">
        <span className="flex items-center gap-1 text-[10px] text-white/65">
          <Receipt className="size-2.5" /> Gasto do mês
        </span>
        <span className="truncate text-sm font-bold tabular-nums">{formatMoney(0)}</span>
      </div>
    </>
  );
}

const CHIP_CLASS =
  "flex min-w-0 flex-1 flex-col items-start rounded-full bg-white/10 px-3 py-1 text-left leading-tight transition-colors hover:bg-white/15 sm:flex-none sm:px-4";

function BalanceChips({ trackingId }: { trackingId: string }) {
  const { data, isLoading } = useMetaNumberPanel(trackingId);

  if (isLoading) {
    return (
      <>
        <span className="h-9 flex-1 animate-pulse rounded-full bg-white/10 sm:w-36 sm:flex-none" />
        <span className="h-9 flex-1 animate-pulse rounded-full bg-white/10 sm:w-36 sm:flex-none" />
      </>
    );
  }
  if (!data?.phone) return <EmptyBalanceChips />;

  const dailyLimit = data.limit.dailyUniqueContacts;
  const remainingToday = data.remainingToday;
  const metaCurrency = data.spend.currency ?? "BRL";
  const metaSpent = data.spend.isAvailable ? data.spend.total : 0;
  const orbitaFeesBrl = data.orbitaFees.totalBrl;
  // Conta da Meta em outra moeda: não soma moedas diferentes, o total fica só com o que é em real.
  const monthTotalBrl = orbitaFeesBrl + (metaCurrency === "BRL" ? metaSpent : 0);
  const monthName = new Date().toLocaleDateString("pt-BR", { month: "long" });

  return (
    <>
      <div className={CHIP_CLASS} title="Contatos que ainda cabem no limite da Meta nas últimas 24h">
        <span className="flex items-center gap-1 text-[10px] text-white/65">
          <Gauge className="size-2.5" /> Disponível hoje
        </span>
        <span className="truncate text-sm font-bold tabular-nums">
          {dailyLimit === null || remainingToday === null
            ? "Sem limite"
            : `${remainingToday.toLocaleString("pt-BR")} / ${dailyLimit.toLocaleString("pt-BR")}`}
        </span>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={CHIP_CLASS}>
            <span className="flex items-center gap-1 text-[10px] text-white/65">
              <Receipt className="size-2.5" /> Gasto do mês
            </span>
            <span className="truncate text-sm font-bold tabular-nums">{formatMoney(monthTotalBrl)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-[300px] max-w-[calc(100vw-1rem)] p-4">
          <p className="text-sm font-semibold">Gasto em {monthName}</p>
          <p className="mb-3 text-xs text-muted-foreground">Mensagens cobradas pela Meta, por categoria.</p>
          {data.spend.isAvailable && data.spend.byCategory.length > 0 ? (
            <ul className="space-y-2">
              {data.spend.byCategory.map((item) => (
                <li key={item.category} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {META_PRICING_CATEGORY_LABELS[item.category] ?? item.category}
                    </span>
                    <span className="text-xs text-muted-foreground">{item.volume.toLocaleString("pt-BR")} mensagens</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatMoney(item.cost, metaCurrency)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {data.spend.isAvailable ? "Nenhuma mensagem cobrada neste mês." : "A Meta não devolveu o gasto agora."}
            </p>
          )}
          <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
            <p className="flex justify-between">
              <span className="text-muted-foreground">Meta</span>
              <span className="font-medium tabular-nums">{data.spend.isAvailable ? formatMoney(metaSpent, metaCurrency) : "—"}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Taxa ÓRBITA</span>
              <span className="font-medium tabular-nums">{formatMoney(orbitaFeesBrl)}</span>
            </p>
          </div>
          <a
            href={data.links.billingActivity}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-info hover:underline"
          >
            <ExternalLink className="size-3.5" /> Ver fatura na Meta
          </a>
        </PopoverContent>
      </Popover>
    </>
  );
}
