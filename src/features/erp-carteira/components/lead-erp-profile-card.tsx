"use client";

import { Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLeadErpProfile } from "../hooks/use-erp-carteira";

// Spec 0106 (RF-8): o que o ERP sabe do cliente. Sem perfil (lead que não veio da carteira), não aparece.

function formatMoney(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function LeadErpProfileCard({ leadId }: { leadId: string }) {
  const { data } = useLeadErpProfile(leadId);
  const profile = data?.profile;
  if (!profile) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold text-sm">
          <Database className="size-4 text-primary" />
          Carteira ERP
        </span>
        <Badge variant={profile.isOverdue ? "destructive" : "secondary"}>
          {profile.isOverdue ? "Inadimplente" : "Em dia"}
        </Badge>
      </div>
      {profile.isOverdue && data.canSeeDebt && (
        <Row
          label="Em atraso"
          value={`${formatMoney(profile.overdueAmount)} · ${profile.overdueInstallments} parcela(s) desde ${formatDate(profile.oldestOverdueAt)}`}
        />
      )}
      <Row
        label="Última compra"
        value={`${formatDate(profile.lastPurchaseAt)} · ${formatMoney(profile.lastPurchaseAmount)}`}
      />
      <Row label="Total comprado" value={`${formatMoney(profile.totalPurchased)} em ${profile.ordersCount} pedido(s)`} />
      <Row label="Cliente desde" value={formatDate(profile.customerSince ?? profile.firstPurchaseAt)} />
      {profile.branchName && <Row label="Filial" value={profile.branchName} />}
      {profile.consultantName && <Row label="Consultor no ERP" value={profile.consultantName} />}
      {profile.lastProducts.length > 0 && (
        <Row label="Últimos produtos" value={profile.lastProducts.join(", ")} />
      )}
      <p className="text-[11px] text-muted-foreground">
        Código {profile.customerCodes.join(", ")} · atualizado em {formatDate(profile.syncedAt)}
      </p>
    </div>
  );
}
