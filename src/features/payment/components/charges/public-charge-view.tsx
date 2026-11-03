"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Copy, FileDown, Loader2 } from "lucide-react";
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
  /** Boleto com PIX do banco (spec 0133). */
  boletoDigitableLine: string | null;
  boletoPdfUrl: string | null;
  /** O banco ainda está gerando o boleto (leva segundos). */
  isBoletoProcessing: boolean;
};

const STATUS_TEXT: Record<PublicChargeViewData["status"], string> = {
  OPEN: "Em aberto",
  OVERDUE: "Vencida",
  PAID: "Paga",
  CANCELLED: "Cancelada",
};

export function PublicChargeView({ charge }: { charge: PublicChargeViewData }) {
  const [copiedField, setCopiedField] = useState<"pix" | "boleto" | null>(null);
  const isOpen = charge.status === "OPEN" || charge.status === "OVERDUE";

  async function handleCopy(field: "pix" | "boleto", value: string | null) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2500);
    } catch {
      setCopiedField(null);
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
            <Button className="w-full gap-2" onClick={() => void handleCopy("pix", charge.pixCode)}>
              <Copy className="size-4" />
              {copiedField === "pix" ? "Código copiado" : "Copiar código PIX"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Abra o app do seu banco, escolha PIX copia e cola ou leia o QR Code. A confirmação pode levar
              alguns minutos para aparecer aqui.
            </p>
          </section>
        )}

        {isOpen && charge.boletoDigitableLine && (
          <section className="space-y-3 border-t pt-5">
            <p className="text-sm font-medium">Ou pague com boleto</p>
            <p className="break-all rounded-lg border bg-muted/40 p-3 font-mono text-xs">{charge.boletoDigitableLine}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-2" onClick={() => void handleCopy("boleto", charge.boletoDigitableLine)}>
                <Copy className="size-4" />
                {copiedField === "boleto" ? "Copiado" : "Copiar linha"}
              </Button>
              {charge.boletoPdfUrl && (
                <Button variant="outline" className="gap-2" asChild>
                  <a href={charge.boletoPdfUrl} target="_blank" rel="noopener noreferrer">
                    <FileDown className="size-4" />
                    Baixar boleto
                  </a>
                </Button>
              )}
            </div>
          </section>
        )}

        {isOpen && charge.isBoletoProcessing && (
          <p className="flex items-center gap-2 rounded-xl border p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            O banco está gerando o boleto. Atualize a página em alguns segundos.
          </p>
        )}

        {isOpen && !charge.pixCode && !charge.isBoletoProcessing && (
          <p className="rounded-xl border p-4 text-sm text-muted-foreground">
            Para pagar, fale com {charge.organizationName}.
          </p>
        )}
      </div>
    </main>
  );
}
