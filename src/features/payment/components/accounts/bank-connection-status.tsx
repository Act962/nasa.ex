"use client";

import { Badge } from "@/components/ui/badge";
import { BANK_PROVIDERS, type BankProviderId } from "../../lib/bank-providers";
import { DAY_MS } from "../../lib/dates";

// Selo do estado da conexão com o banco, usado na lista de contas e no painel.

export type BankConnectionStatus = "ACTIVE" | "CERTIFICATE_EXPIRED" | "WEBHOOK_PENDING" | "ERROR";

const STATUS_LABELS: Record<BankConnectionStatus, { label: string; className: string; dotClassName: string }> = {
  ACTIVE: {
    label: "PIX com baixa automática",
    className: "border-success/30 bg-success/10 text-success",
    dotClassName: "bg-success",
  },
  WEBHOOK_PENDING: {
    label: "Conectado · baixa automática pendente",
    className: "border-warning/40 bg-warning/10 text-warning",
    dotClassName: "bg-warning",
  },
  ERROR: {
    label: "Conexão com problema",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    dotClassName: "bg-destructive",
  },
  CERTIFICATE_EXPIRED: {
    label: "Certificado vencido",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    dotClassName: "bg-destructive",
  },
};

export function BankConnectionStatusBadge({
  provider,
  status,
}: {
  provider: BankProviderId;
  status: BankConnectionStatus;
}) {
  const { label, className, dotClassName } = STATUS_LABELS[status];
  return (
    <Badge variant="outline" className={`gap-1.5 font-normal ${className}`}>
      <span className={`size-1.5 rounded-full ${dotClassName}`} />
      {BANK_PROVIDERS[provider].name} · {label}
    </Badge>
  );
}

export function daysUntil(date: Date | string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / DAY_MS);
}
