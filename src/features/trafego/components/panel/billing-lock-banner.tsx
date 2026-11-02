"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";

/** Aviso da trava do painel: complemento enviado e vencido (spec 0123, RF-15). */

interface BillingLockBannerProps {
  orderCode: string;
  complement: {
    documentNumber: string;
    amountBrlCents: number;
    paidBrlCents: number;
    chargeUrl: string | null;
  };
  className?: string;
}

export function BillingLockBanner({ orderCode, complement, className }: BillingLockBannerProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-destructive/40 bg-destructive/5 p-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p className="text-sm">
          O complemento {complement.documentNumber} da campanha {orderCode} venceu (
          {formatBrlFromCents(complement.amountBrlCents - complement.paidBrlCents)}). Criar e publicar campanhas fica
          pausado até o pagamento. Suas campanhas no Meta continuam como estão.
        </p>
      </div>
      {complement.chargeUrl && (
        <Button asChild size="sm" className="rounded-full">
          <a href={complement.chargeUrl} target="_blank" rel="noreferrer">
            Pagar agora
            <ExternalLink className="ml-1 size-3.5" />
          </a>
        </Button>
      )}
    </div>
  );
}
