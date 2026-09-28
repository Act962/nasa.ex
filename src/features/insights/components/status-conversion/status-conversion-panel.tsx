"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { InfoIcon, TargetIcon, EyeOffIcon } from "lucide-react";
import type { DateRange } from "@/features/insights/types";
import { useStatusConversion } from "@/features/insights/hooks/use-status-conversion";

interface StatusConversionPanelProps {
  trackingId?: string;
  organizationIds?: string[];
  statusIds?: string[];
  tagIds?: string[];
  dateRange?: DateRange;
  onHide?: () => void;
}

const FALLBACK_BAR_COLOR = "#94a3b8";

export function StatusConversionPanel({
  trackingId,
  organizationIds,
  statusIds,
  tagIds,
  dateRange,
  onHide,
}: StatusConversionPanelProps) {
  const hasSpecificTracking = Boolean(trackingId) && trackingId !== "ALL";

  const { conversion, isLoading } = useStatusConversion({
    trackingId,
    organizationIds,
    statusIds,
    tagIds,
    dateRange,
  });

  if (!hasSpecificTracking) {
    return (
      <PanelShell onHide={onHide}>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Selecione um tracking específico para ver a conversão por status.
        </CardContent>
      </PanelShell>
    );
  }

  if (isLoading) {
    return (
      <PanelShell onHide={onHide}>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner />
        </CardContent>
      </PanelShell>
    );
  }

  if (!conversion) {
    return (
      <PanelShell onHide={onHide}>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Não foi possível carregar a conversão por status.
        </CardContent>
      </PanelShell>
    );
  }

  const {
    totalLeads,
    statuses,
    leadsInAnySelectedStatus,
    percentInAnySelectedStatus,
    hasJourneyData,
  } = conversion;

  return (
    <PanelShell onHide={onHide} subtitle={buildSubtitle(totalLeads, statuses.length)}>
      <CardContent className="space-y-4">
        {statuses.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum status configurado neste tracking.
          </p>
        ) : totalLeads === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum lead criado no período selecionado.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {statuses.map((status) => (
                <div key={status.statusId} className="flex items-center gap-3">
                  <div className="w-36 shrink-0 truncate text-sm font-medium">
                    {status.name}
                  </div>
                  <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 transition-all"
                      style={{
                        width: `${Math.min(status.percentOfTotal, 100)}%`,
                        backgroundColor: status.color ?? FALLBACK_BAR_COLOR,
                        opacity: 0.85,
                      }}
                    />
                    <div className="relative z-10 flex h-full items-center px-3 text-sm font-medium text-white drop-shadow">
                      {status.leadCount}
                    </div>
                  </div>
                  <div className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {status.percentOfTotal.toLocaleString("pt-BR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    %
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
                <div className="space-y-1">
                  <p>
                    <span className="font-semibold text-foreground">
                      {leadsInAnySelectedStatus}
                    </span>{" "}
                    lead(s) passaram por ao menos um dos status selecionados (
                    {percentInAnySelectedStatus.toLocaleString("pt-BR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    % do total).
                  </p>
                  <p>
                    Os números por status se sobrepõem — um mesmo lead pode
                    contar em mais de uma linha. Não some as linhas.
                  </p>
                </div>
              </div>
            </div>

            {!hasJourneyData && (
              <p className="text-xs text-amber-600">
                Este período é anterior ao registro de jornada — os números
                refletem apenas o status atual de cada lead.
              </p>
            )}
          </>
        )}
      </CardContent>
    </PanelShell>
  );
}

function buildSubtitle(totalLeads: number, statusCount: number): string {
  const leadsLabel = `${totalLeads} lead(s) criados no período`;
  const statusLabel =
    statusCount > 0 ? ` · ${statusCount} status` : "";
  return leadsLabel + statusLabel;
}

function PanelShell({
  children,
  subtitle,
  onHide,
}: {
  children: React.ReactNode;
  subtitle?: string;
  onHide?: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TargetIcon className="size-5" />
              Conversão por Status
            </CardTitle>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {onHide && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              onClick={onHide}
              aria-label="Ocultar painel de conversão"
            >
              <EyeOffIcon className="size-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}
