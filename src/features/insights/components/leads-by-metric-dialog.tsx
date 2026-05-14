"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, Users } from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import relativeTime from "dayjs/plugin/relativeTime";
import { useDashboardStore } from "../hooks/use-dashboard-store";

dayjs.extend(relativeTime);
dayjs.locale("pt-br");

export type LeadMetricApp = "lead" | "forge" | "spacetime" | "chat";

export type LeadMetricKey =
  | "lead.total"
  | "lead.active"
  | "lead.won"
  | "lead.lost"
  | "lead.byStatus"
  | "lead.bySource"
  | "lead.byUtmCampaign"
  | "lead.byUtmSource"
  | "forge.rascunho"
  | "forge.enviadas"
  | "forge.visualizadas"
  | "forge.pagas"
  | "forge.expiradas"
  | "forge.canceladas"
  | "forge.totalProposals"
  | "spacetime.total"
  | "spacetime.pending"
  | "spacetime.confirmed"
  | "spacetime.done"
  | "spacetime.cancelled"
  | "spacetime.noShow"
  | "spacetime.withLead"
  | "chat.totalConversations"
  | "chat.attendedConversations"
  | "chat.unattendedConversations";

interface LeadsByMetricDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: LeadMetricApp;
  metric: LeadMetricKey;
  title: string;
  description?: string;
  // Filtros adicionais pra métricas parametrizadas (lead.byStatus etc).
  extra?: {
    statusId?: string;
    source?: string;
    utmCampaign?: string;
    utmSource?: string;
  };
}

export function LeadsByMetricDialog({
  open,
  onOpenChange,
  app,
  metric,
  title,
  description,
  extra,
}: LeadsByMetricDialogProps) {
  // Sincroniza filtros com o dashboard: organizationIds, dateRange,
  // trackingId e tagIds. Sem isso o popup mostra leads que o card
  // filtrou pra fora (cards com 0 abrindo lista).
  const { organizationIds, dateRange, trackingId, tagIds } = useDashboardStore();
  const [limit, setLimit] = useState(10);

  const { data, isLoading } = useQuery({
    ...orpc.insights.listLeadsByAppMetric.queryOptions({
      input: {
        app,
        metric,
        organizationIds: organizationIds.length > 0 ? organizationIds : undefined,
        startDate: dateRange.from?.toISOString(),
        endDate: dateRange.to?.toISOString(),
        trackingId: trackingId || undefined,
        tagIds: tagIds.length > 0 ? tagIds : undefined,
        statusId: extra?.statusId,
        source: extra?.source,
        utmCampaign: extra?.utmCampaign,
        utmSource: extra?.utmSource,
        limit,
      },
    }),
    enabled: open,
  });

  const leads = data?.leads ?? [];
  const total = data?.total ?? 0;
  const hasMore = total > limit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-h-[85vh] garante que o dialog nunca extrapola a viewport,
          mesmo após múltiplos "Ver mais". flex-col + min-h-0 no body
          deixa a lista shrinkar e ativar overflow interno. */}
      <DialogContent className="max-w-2xl p-0 overflow-hidden flex flex-col max-h-[85vh]">
        <DialogHeader className="px-6 pt-6 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4" />
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
          {total > 0 && (
            <p className="text-xs text-muted-foreground">
              Mostrando {leads.length} de {total} lead{total === 1 ? "" : "s"}
            </p>
          )}
        </DialogHeader>

        <div className="border-t flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <CheckCircle2 className="size-10 text-emerald-500 mb-2" />
              <p className="text-sm font-medium">Nenhum lead nesta métrica</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tente ajustar o filtro de período ou empresa.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {leads.map((lead) => (
                <LeadRow key={`${lead.id}-${lead.metricAt ?? ""}`} lead={lead} />
              ))}
            </div>
          )}
        </div>

        {hasMore && (
          <div className="border-t px-6 py-3 flex justify-center shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLimit((v) => v + 10)}
              disabled={isLoading}
            >
              Ver mais ({total - leads.length} restantes)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface LeadRowProps {
  lead: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    responsible: { id: string; name: string; image: string | null } | null;
    status: { id: string; name: string; color: string | null } | null;
    tracking: { id: string; name: string; organizationId: string } | null;
    metricLabel?: string | null;
    metricAt?: string | Date | null;
  };
}

function LeadRow({ lead }: LeadRowProps) {
  const initials = lead.name?.[0]?.toUpperCase() ?? "?";
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
      <Avatar className="size-9">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{lead.name}</span>
          {lead.status?.name && (
            <Badge
              variant="outline"
              style={{
                color: lead.status.color ?? undefined,
                borderColor: lead.status.color ?? undefined,
              }}
              className="text-[10px] py-0 h-4"
            >
              {lead.status.name}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {lead.phone ?? lead.email ?? "—"}
          {lead.tracking?.name ? ` · ${lead.tracking.name}` : ""}
        </div>
        {lead.metricLabel && (
          <div className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
            {lead.metricLabel}
            {lead.metricAt ? ` · ${dayjs(lead.metricAt).fromNow()}` : ""}
          </div>
        )}
      </div>
      {lead.responsible?.name && (
        <div className="text-xs text-muted-foreground hidden sm:block">
          {lead.responsible.name}
        </div>
      )}
      <Button asChild size="sm" variant="outline" className="ml-2">
        <a
          href={`/contatos/${lead.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver
        </a>
      </Button>
    </div>
  );
}
