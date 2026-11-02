"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTrafegoServiceFee } from "@/features/trafego/hooks/use-trafego-performance";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";

/** "Taxa sobre o gasto real" do Desempenho (spec 0123, RF-14). */

function formatCalendarDate(isoDate: string): string {
  return isoDate.split("-").reverse().join("/");
}

export function ServiceFeeSection({ orderId }: { orderId: string }) {
  const { data } = useTrafegoServiceFee(orderId);
  if (!data?.applies) return null;

  const openComplements = data.complements.filter((complement) => complement.chargeUrl);

  return (
    <div className="rounded-[20px] border bg-card p-4">
      <p className="text-sm font-medium">Taxa sobre o gasto real</p>
      <p className="mt-1 text-xs text-muted-foreground">
        O serviço é 30% do que a conta gastou no período, com mínimo de R$ 150. Se o gasto passar da verba
        declarada, a diferença da taxa vira um complemento.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Gasto real</dt>
          <dd className="font-semibold tabular-nums">
            {data.spentBrlCents === null ? "—" : formatBrlFromCents(data.spentBrlCents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Taxa devida</dt>
          <dd className="font-semibold tabular-nums">
            {data.dueFeeBrlCents === null ? "—" : formatBrlFromCents(data.dueFeeBrlCents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Taxa paga</dt>
          <dd className="font-semibold tabular-nums">{formatBrlFromCents(data.paidBrlCents)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Em aberto</dt>
          <dd className="font-semibold tabular-nums">
            {formatBrlFromCents(
              openComplements.reduce(
                (total, complement) => total + complement.amountBrlCents - complement.paidBrlCents,
                0,
              ),
            )}
          </dd>
        </div>
      </dl>

      {openComplements.map((complement) => (
        <div
          key={complement.id}
          className={
            complement.isOverdue
              ? "mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[16px] border border-destructive/40 bg-destructive/5 px-3 py-2"
              : "mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[16px] border px-3 py-2"
          }
        >
          <p className="flex items-center gap-1.5 text-xs">
            {complement.isOverdue && <AlertTriangle className="size-3.5 text-destructive" />}
            Complemento {complement.documentNumber}: {formatBrlFromCents(complement.amountBrlCents - complement.paidBrlCents)} ·{" "}
            {complement.isOverdue ? "venceu" : "vence"} em {formatCalendarDate(complement.dueDate)}
          </p>
          <Button asChild size="sm" className="h-8 rounded-full">
            <a href={complement.chargeUrl ?? "#"} target="_blank" rel="noreferrer">
              Pagar
              <ExternalLink className="ml-1 size-3.5" />
            </a>
          </Button>
        </div>
      ))}
    </div>
  );
}
