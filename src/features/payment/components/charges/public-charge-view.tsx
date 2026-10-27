"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "../../lib/format";
import { formatCalendarDate } from "../../lib/dates";

export type PublicChargeViewData = {
  organizationName: string;
  organizationLogo: string | null;
  description: string;
  customerName: string | null;
  amountCents: number;
  openAmountCents: number;
  dueDate: Date;
  status: "OPEN" | "OVERDUE" | "PAID" | "CANCELLED";
  paidAt: Date | null;
  installmentLabel: string | null;
  pixCode: string | null;
};

const STATUS_TEXT: Record<PublicChargeViewData["status"], string> = {
  OPEN: "Em aberto",
  OVERDUE: "Vencida",
  PAID: "Paga",
  CANCELLED: "Cancelada",
};

export function PublicChargeView({ charge }: { charge: PublicChargeViewData }) {
  const [isCopied, setIsCopied] = useState(false);
  const isOpen = charge.status === "OPEN" || charge.status === "OVERDUE";

  async function handleCopyPix() {
    if (!charge.pixCode) return;
    try {
      await navigator.clipboard.writeText(charge.pixCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      setIsCopied(false);
    }
  }

  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6 rounded-2xl border bg-background p-6 shadow-sm">
        <header className="flex items-center gap-3">
          {charge.organizationLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={charge.organizationLogo} alt="" className="size-10 rounded-full object-cover" />
          ) : null}
          <div>
            <p className="text-sm text-muted-foreground">Cobrança de</p>
            <p className="font-semibold">{charge.organizationName}</p>
          </div>
        </header>

        <section className="space-y-1">
          {charge.customerName && <p className="text-sm text-muted-foreground">Para {charge.customerName}</p>}
          <p className="font-medium">{charge.description}</p>
          {charge.installmentLabel && <p className="text-sm text-muted-foreground">{charge.installmentLabel}</p>}
        </section>

        <section className="grid grid-cols-2 gap-4 rounded-xl bg-muted/60 p-4">
          <div>
            <p className="text-xs text-muted-foreground">{isOpen ? "Valor a pagar" : "Valor"}</p>
            <p className="text-xl font-semibold">
              {formatCurrency(isOpen ? charge.openAmountCents : charge.amountCents)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vencimento</p>
            <p className="text-xl font-semibold">{formatCalendarDate(charge.dueDate)}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Situação</p>
            <p className={charge.status === "OVERDUE" ? "font-medium text-destructive" : "font-medium"}>
              {STATUS_TEXT[charge.status]}
            </p>
          </div>
        </section>

        {charge.status === "PAID" && (
          <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-4 text-sm">
            <CheckCircle2 className="size-5 text-success" />
            <span>
              Pagamento confirmado{charge.paidAt ? ` em ${formatCalendarDate(charge.paidAt)}` : ""}. Obrigado!
            </span>
          </div>
        )}

        {isOpen && charge.pixCode && (
          <section className="space-y-4">
            <p className="text-sm font-medium">Pague com PIX</p>
            <div className="flex justify-center rounded-xl border bg-white p-4">
              <QRCodeSVG value={charge.pixCode} size={208} />
            </div>
            <p className="break-all rounded-lg border bg-muted/40 p-3 font-mono text-xs">{charge.pixCode}</p>
            <Button className="w-full gap-2" onClick={handleCopyPix}>
              <Copy className="size-4" />
              {isCopied ? "Código copiado" : "Copiar código PIX"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Abra o app do seu banco, escolha PIX copia e cola ou leia o QR Code. A confirmação pode levar
              alguns minutos para aparecer aqui.
            </p>
          </section>
        )}

        {isOpen && !charge.pixCode && (
          <p className="rounded-xl border p-4 text-sm text-muted-foreground">
            Para pagar, fale com {charge.organizationName}.
          </p>
        )}
      </div>
    </main>
  );
}
