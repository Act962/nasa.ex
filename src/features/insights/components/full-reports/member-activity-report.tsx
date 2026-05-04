"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Download, Trophy, Clock, Star, Coins, Sparkles } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatDuration, exportToCSV } from "./format-utils";
import { APP_LABELS } from "@/lib/activity-constants";

interface Props {
  from: string;
  to: string;
  memberIds: string[];
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const RANK_COLORS = ["#facc15", "#94a3b8", "#fb923c"];

export function MemberActivityReport({ from, to, memberIds }: Props) {
  const { data, isLoading } = useQuery({
    ...orpc.insights.getMemberActivityReport.queryOptions({
      input: { from, to, memberIds: memberIds.length > 0 ? memberIds : undefined },
    }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const members = data?.members ?? [];
  const orgTotals = data?.orgTotals;

  const handleExport = () => {
    const rows = members.map((m, idx) => ({
      Posição: idx + 1,
      Membro: m.name,
      Email: m.email,
      Cargo: m.role,
      "Total ações": m.totals.totalActions,
      "Tempo total": formatDuration(m.totals.totalTimeMs),
      "Tempo médio sessão": formatDuration(m.totals.avgSessionMs),
      "App mais usado":
        m.totals.mostUsedApp
          ? APP_LABELS[m.totals.mostUsedApp] ?? m.totals.mostUsedApp
          : "—",
      "Stars consumidas": m.totals.starsConsumed,
      "Space Points": m.totals.spacePoints,
      "Hora pico": `${m.totals.peakHour}h`,
    }));
    exportToCSV(rows, `membros-atividade-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" />
          <strong className="text-foreground">{data?.totalMembers ?? 0}</strong>
          membros
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={members.length === 0}
        >
          <Download className="size-3.5 mr-1.5" /> Exportar CSV
        </Button>
      </div>

      {orgTotals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            label="Tempo médio plataforma"
            value={formatDuration(orgTotals.avgPlatformTimeMs)}
            icon={<Clock className="size-4" />}
          />
          <SummaryCard
            label="App mais usado"
            value={
              orgTotals.mostUsedApp
                ? APP_LABELS[orgTotals.mostUsedApp] ?? orgTotals.mostUsedApp
                : "—"
            }
            icon={<Sparkles className="size-4" />}
          />
          <SummaryCard
            label="Stars consumidas"
            value={orgTotals.starsConsumed}
            icon={<Star className="size-4 text-yellow-500" />}
          />
          <SummaryCard
            label="Space Points"
            value={orgTotals.totalSpacePoints}
            icon={<Coins className="size-4 text-amber-600" />}
          />
        </div>
      )}

      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          Nenhum membro encontrado para o período/filtros selecionados.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Trophy className="size-4 text-yellow-500" /> Ranking
            </h3>
            <div className="space-y-2">
              {members.slice(0, 10).map((m, idx) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40"
                >
                  <div
                    className="size-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      backgroundColor: RANK_COLORS[idx] ?? "#e5e7eb",
                      color: idx < 3 ? "white" : "#374151",
                    }}
                  >
                    {idx + 1}
                  </div>
                  <Avatar className="size-9">
                    <AvatarImage src={m.image ?? ""} />
                    <AvatarFallback>{initials(m.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{m.name}</span>
                      <Badge variant="secondary" className="capitalize text-[10px]">
                        {m.role}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                      <span>{m.totals.totalActions} ações</span>
                      <span>•</span>
                      <span>{formatDuration(m.totals.totalTimeMs)}</span>
                      {m.totals.mostUsedApp && (
                        <>
                          <span>•</span>
                          <span>
                            {APP_LABELS[m.totals.mostUsedApp] ?? m.totals.mostUsedApp}
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span>Pico: {m.totals.peakHour}h</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[9px] uppercase text-muted-foreground">
                        SP
                      </div>
                      <div className="text-xs font-semibold">
                        {m.totals.spacePoints}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] uppercase text-muted-foreground">
                        Stars
                      </div>
                      <div className="text-xs font-semibold">
                        {m.totals.starsConsumed}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {members[0] && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock className="size-4" /> Período de maior atividade — {members[0].name}
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={members[0].hourlyDistribution}>
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(h) => `${h}h`}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    labelFormatter={(h) => `${h}h`}
                    formatter={(v: number) => [v, "Ações"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {members[0].hourlyDistribution.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={
                          entry.hour === members[0].totals.peakHour
                            ? "#10b981"
                            : "#94a3b8"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="text-base font-semibold mt-1 truncate">{value}</div>
    </div>
  );
}
