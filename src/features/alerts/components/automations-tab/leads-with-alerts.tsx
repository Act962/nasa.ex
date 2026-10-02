"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { ArrowRight, ChevronLeft, ChevronRight, User2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AppKey } from "@/features/alerts/lib/alert-catalog";

interface Props {
  appKey: AppKey;
}

/**
 * Lista leads que dispararam alertas recentemente no app selecionado.
 *
 * - Pagina 10/página (botões anterior/próxima).
 * - Cada linha mostra: nome do lead, status, qtde de alertas, último alerta.
 * - "Ver detalhes" → /contatos/<leadId> (página de detalhes existente).
 *
 * Só renderizada quando há ao menos um lead com alerta no app.
 */
export function LeadsWithAlerts({ appKey }: Props) {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const q = useQuery(
    orpc.alerts.leadsWithAlerts.queryOptions({
      input: { appKey, page, pageSize },
    }),
  );

  // Esconde a seção quando ainda está carregando inicial OU não tem nenhum.
  if (q.isLoading) {
    return (
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Leads em atenção
        </div>
        <div className="text-xs text-muted-foreground">Carregando leads…</div>
      </div>
    );
  }

  const items = q.data?.items ?? [];
  const totalLeads = q.data?.totalLeads ?? 0;
  const hasMore = q.data?.hasMore ?? false;

  if (totalLeads === 0) {
    // Não mostra a seção se nenhum lead disparou alerta — evita ruído visual.
    return null;
  }

  const startIdx = (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, totalLeads);
  const totalPages = Math.max(1, Math.ceil(totalLeads / pageSize));

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Leads em atenção
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Leads que dispararam alertas nos últimos 30 dias.
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {startIdx}–{endIdx} de {totalLeads}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-panel divide-y divide-line">
        {items.map((it) => (
          <LeadRow key={it.leadId} item={it} />
        ))}
      </div>

      {/* Paginação — só mostra se houver mais de 1 página. */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={cn(
              "inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors",
              page === 1
                ? "text-muted-foreground/70 cursor-not-allowed"
                : "text-foreground hover:bg-muted",
            )}
          >
            <ChevronLeft className="w-3 h-3" />
            Anterior
          </button>
          <div className="text-[11px] text-muted-foreground">
            Página {page} de {totalPages}
          </div>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className={cn(
              "inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors",
              !hasMore
                ? "text-muted-foreground/70 cursor-not-allowed"
                : "text-foreground hover:bg-muted",
            )}
          >
            Próxima
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

interface LeadItem {
  leadId: string;
  leadName: string;
  leadPhone: string | null;
  trackingId: string | null;
  trackingName: string | null;
  statusName: string | null;
  statusColor: string | null;
  lastAlertAt: string;
  lastAlertTitle: string;
  lastAlertSeverity: string;
  alertCount: number;
}

function LeadRow({ item }: { item: LeadItem }) {
  const sevColor =
    item.lastAlertSeverity === "critical"
      ? "text-destructive"
      : item.lastAlertSeverity === "warning"
        ? "text-warning"
        : "text-info";

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="p-1.5 rounded-md bg-muted/60 text-muted-foreground shrink-0">
        <User2 className="w-3.5 h-3.5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-foreground truncate">
            {item.leadName}
          </span>
          {item.statusName && (
            <span
              className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: item.statusColor
                  ? `${item.statusColor}20`
                  : "var(--muted)",
                color: item.statusColor ?? "var(--muted-foreground)",
              }}
            >
              {item.statusName}
            </span>
          )}
          {item.alertCount > 1 && (
            <span className="inline-flex items-center text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
              {item.alertCount} alertas
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
          <span className={sevColor}>{item.lastAlertTitle}</span>
          {" · "}
          <span className="text-muted-foreground/70">
            {formatDistanceToNow(new Date(item.lastAlertAt), {
              locale: ptBR,
              addSuffix: true,
            })}
          </span>
          {item.trackingName && (
            <>
              {" · "}
              <span className="text-muted-foreground/70">{item.trackingName}</span>
            </>
          )}
        </div>
      </div>

      <Link
        href={`/contatos/${item.leadId}`}
        className="shrink-0 inline-flex items-center gap-1 text-[11px] text-foreground hover:text-foreground bg-muted hover:bg-knob px-2 py-1.5 rounded-md transition-colors"
        title="Ver detalhes do lead"
      >
        Ver detalhes
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
