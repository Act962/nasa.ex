"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Download, ExternalLink } from "lucide-react";
import { APP_LABELS } from "@/lib/activity-constants";
import { cn } from "@/lib/utils";
import { buildResourceUrl } from "@/features/insights/lib/build-resource-url";

interface Props {
  userIds?: string[];
  appSlug?: string;
  startDate: string;
  endDate?: string;
  limit: number;
  onLoadMore: () => void;
  onExport?: () => void;
}

function isLightUrl(href: string | null) {
  return !!href && !href.startsWith("javascript:");
}

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  owner: { label: "Master", color: "text-violet-700", bg: "bg-violet-100" },
  admin: { label: "Adm", color: "text-blue-700", bg: "bg-blue-100" },
  member: { label: "Single", color: "text-slate-700", bg: "bg-slate-100" },
  moderador: { label: "Moderador", color: "text-orange-700", bg: "bg-orange-100" },
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | null | undefined) {
  if (!ms) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const restSec = sec - min * 60;
  if (min < 60) return restSec ? `${min}m ${restSec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const restMin = min - hr * 60;
  return restMin ? `${hr}h ${restMin}m` : `${hr}h`;
}

function prettifyFeatureKey(key: string | null | undefined, subAppSlug: string | null | undefined) {
  if (subAppSlug) {
    const map: Record<string, string> = {
      "tracking-pipeline": "Pipeline",
      "tracking-chat": "Chat",
      "tracking-leads": "Leads",
      "spacetime-events": "Eventos",
      "workspace-actions": "Ações",
      "workspace-cards": "Cards",
      "nasa-route-courses": "Cursos",
    };
    if (map[subAppSlug]) return map[subAppSlug];
  }
  if (!key) return "—";
  const last = key.split(".").pop() ?? key;
  return last
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ActivityTable({
  userIds,
  appSlug,
  startDate,
  endDate,
  limit,
  onLoadMore,
  onExport,
}: Props) {
  const { data, isLoading } = useQuery({
    ...orpc.activity.getLogs.queryOptions({
      input: {
        ...(userIds && userIds.length > 0 ? { userIds } : {}),
        ...(appSlug ? { appSlug } : {}),
        startDate,
        ...(endDate ? { endDate } : {}),
        limit,
        offset: 0,
      },
    }),
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const { data: stats } = useQuery({
    ...orpc.activity.getStats.queryOptions({
      input: { period: "30d" },
    }),
  });

  const members = stats?.members ?? [];
  const logs = data?.logs ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Clock className="size-4" />
          Tabela detalhada
          {data?.total != null && (
            <span className="text-xs font-normal text-muted-foreground">
              ({data.total} registros)
            </span>
          )}
        </h3>
        {onExport && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={onExport}>
            <Download className="size-3.5" /> Exportar CSV
          </Button>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 border-b">
              <tr className="text-left">
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Nome</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">App</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Funcionalidade</th>
                <th className="px-3 py-2 font-semibold">O que fez</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Tempo</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Data</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-3 py-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">
                    Nenhuma atividade encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => {
                  const memberInfo = members.find((m) => m.id === log.userId);
                  const role = memberInfo?.role ?? "member";
                  const roleMeta = ROLE_META[role] ?? ROLE_META.member;
                  const appLabel = APP_LABELS[log.appSlug] ?? log.appSlug;
                  const url = buildResourceUrl(log);
                  return (
                    <tr key={log.id} className="hover:bg-muted/10">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="size-6 shrink-0">
                            <AvatarImage src={log.userImage ?? ""} alt={log.userName} />
                            <AvatarFallback className="text-[9px]">
                              {initials(log.userName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <span className="font-medium truncate block max-w-[140px]">
                              {log.userName}
                            </span>
                            <span
                              className={cn(
                                "inline-flex text-[9px] font-bold rounded px-1 py-px",
                                roleMeta.color,
                                roleMeta.bg,
                              )}
                            >
                              {roleMeta.label}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {appLabel}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {prettifyFeatureKey(log.featureKey, log.subAppSlug)}
                      </td>
                      <td className="px-3 py-2 max-w-[300px] truncate" title={log.actionLabel}>
                        {log.actionLabel}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatDuration(log.durationMs)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        {isLightUrl(url) ? (
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] gap-1 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                          >
                            <Link href={url!}>
                              <ExternalLink className="size-3" /> Abrir
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground/50 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {logs.length >= limit && (data?.total ?? 0) > limit && (
          <div className="py-3 text-center border-t bg-muted/10">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              className="text-xs"
            >
              Carregar mais ({(data?.total ?? 0) - limit} restantes)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
