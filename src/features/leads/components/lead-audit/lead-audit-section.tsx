"use client";

import { LeadAuditButton } from "./lead-audit-button";
import { LeadAuditDetails } from "./lead-audit-details";
import type { LeadMetricsView } from "./metric-format";

// Bloco "Auditar Lead" da página do contato (a lateral do chat monta as peças
// no próprio layout).

export function LeadAuditSection({ leadId, metrics }: { leadId: string; metrics: LeadMetricsView | null | undefined }) {
  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">Auditoria do lead</span>
        <LeadAuditButton leadId={leadId} />
      </div>
      {metrics ? (
        <LeadAuditDetails metrics={metrics} />
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Este lead ainda não foi auditado. Clique em "Auditar Lead" para calcular as métricas.
        </p>
      )}
    </div>
  );
}
