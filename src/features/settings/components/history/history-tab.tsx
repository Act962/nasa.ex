"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useOrgRole } from "@/hooks/use-org-role";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Activity, Users, Clock, Filter, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_LABELS } from "@/lib/activity-constants";

// Role colors for chart bars
const MEMBER_COLORS = [
  "#7C3AED", "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#06B6D4", "#84CC16", "#F97316", "#EC4899",
];

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  owner:     { label: "Master",    color: "text-violet-700", bg: "bg-violet-100" },
  admin:     { label: "Adm",      color: "text-blue-700",   bg: "bg-blue-100"   },
  member:    { label: "Single",   color: "text-slate-700",  bg: "bg-slate-100"  },
  moderador: { label: "Moderador", color: "text-orange-700", bg: "bg-orange-100" },
};

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role] ?? { label: role, color: "text-slate-600", bg: "bg-slate-100" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-bold", meta.color, meta.bg)}>
      {meta.label}
    </span>
  );
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function OnlineBadge() {
  const { data, isLoading } = useQuery({
    ...orpc.activity.getOnlineUsers.queryOptions(),
    refetchInterval: 30_000,
  });

  if (isLoading) return <Skeleton className="h-7 w-28 rounded-full" />;

  const count = data?.count ?? 0;
  const online = data?.online ?? [];

  const badge = (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer select-none transition-colors",
      count > 0
        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
        : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900/30",
    )}>
      <span className={cn(
        "size-2 rounded-full shrink-0",
        count > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
      )} />
      {count} online agora
    </div>
  );

  if (count === 0) return badge;

  return (
    <Popover>
      <PopoverTrigger asChild>{badge}</PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
          {count} {count === 1 ? "usuário online" : "usuários online"}
        </p>
        <div className="space-y-0.5">
          {online.map((u) => (
            <div key={u.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50">
              <div className="relative shrink-0">
                <Avatar className="size-7">
                  <AvatarImage src={u.userImage ?? ""} alt={u.userName} />
                  <AvatarFallback className="text-[10px]">{initials(u.userName)}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 border-2 border-background" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{u.userName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{u.userEmail}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground px-2 pt-1.5">
          Ativo nos últimos 5 minutos
        </p>
      </PopoverContent>
    </Popover>
  );
}

// Custom tooltip for chart
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-xs space-y-1 max-w-48">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3">
          <span style={{ color: p.fill ?? p.color }} className="font-medium truncate max-w-28">{p.name}</span>
          <span className="font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function HistoryTab() {
  const { isSingle } = useOrgRole();

  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [selectedApp, setSelectedApp] = useState<string>("all");
  const [showChart, setShowChart] = useState(true);
  const [logsLimit, setLogsLimit] = useState(50);

  // Date range from period — memoized so the query key stays stable between renders
  const startDate = useMemo(() => {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }, [period]);

  // Stats query (for chart)
  const { data: stats, isLoading: statsLoading } = useQuery({
    ...orpc.activity.getStats.queryOptions({
      input: {
        period,
        ...(selectedApp !== "all" ? { appSlug: selectedApp } : {}),
      },
    }),
    enabled: !isSingle,
  });

  // Logs query
  const { data: logsData, isLoading: logsLoading } = useQuery({
    ...orpc.activity.getLogs.queryOptions({
      input: {
        ...(selectedUserId !== "all" ? { userId: selectedUserId } : {}),
        ...(selectedApp !== "all" ? { appSlug: selectedApp } : {}),
        startDate,
        limit: logsLimit,
        offset: 0,
      },
    }),
    enabled: !isSingle,
    refetchInterval: 5_000, // refresh every 5s for near real-time
    staleTime: 0, // always consider data stale
  });

  if (isSingle) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
        <div className="size-14 rounded-full bg-amber-100 flex items-center justify-center">
          <Activity className="size-7 text-amber-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Acesso Restrito</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Apenas Master, Adm e Moderador podem visualizar o histórico de atividades.
          </p>
        </div>
      </div>
    );
  }

  const members = stats?.members ?? [];
  const memberTotals = stats?.memberTotals ?? [];
  const logs = logsData?.logs ?? [];

  // Chart data: member totals bar chart
  const chartData = memberTotals.map((m, i) => ({
    name: m.name.split(" ")[0], // first name only for chart
    fullName: m.name,
    total: m.total,
    color: MEMBER_COLORS[i % MEMBER_COLORS.length],
  }));

  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="size-6" /> Histórico de Atividades
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Rastreamento completo de todas as ações realizadas pelos membros da organização.
          </p>
        </div>
        <OnlineBadge />
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="size-3.5" /> Filtros:
        </div>

        {/* Period */}
        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
          <SelectTrigger className="h-8 text-xs w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>

        {/* Member */}
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue placeholder="Todos os membros" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os membros</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* App */}
        <Select value={selectedApp} onValueChange={setSelectedApp}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue placeholder="Todos os apps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os apps</SelectItem>
            {Object.entries(APP_LABELS).map(([slug, label]) => (
              <SelectItem key={slug} value={slug}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset */}
        {(selectedUserId !== "all" || selectedApp !== "all") && (
          <Button variant="ghost" size="sm" className="h-8 text-xs"
            onClick={() => { setSelectedUserId("all"); setSelectedApp("all"); }}>
            Limpar
          </Button>
        )}
      </div>

      {/* ── Chart ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/30 transition-colors"
          onClick={() => setShowChart((v) => !v)}
        >
          <span className="text-sm font-semibold flex items-center gap-2">
            <Users className="size-4" /> Atividade por Membro
            {!statsLoading && (
              <span className="text-xs text-muted-foreground font-normal">
                · {period === "7d" ? "7" : period === "30d" ? "30" : "90"} dias
              </span>
            )}
          </span>
          {showChart ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {showChart && (
          <div className="p-4">
            {statsLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                Nenhuma atividade no período selecionado
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {memberTotals.slice(0, 4).map((m, i) => (
                    <div
                      key={m.userId}
                      className={cn(
                        "rounded-lg border p-3 cursor-pointer transition-colors",
                        selectedUserId === m.userId ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                      )}
                      onClick={() => setSelectedUserId(selectedUserId === m.userId ? "all" : m.userId)}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Avatar className="size-6">
                          <AvatarImage src={m.image ?? ""} />
                          <AvatarFallback className="text-[10px]">{initials(m.name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium truncate">{m.name.split(" ")[0]}</span>
                      </div>
                      <p className="text-xl font-bold" style={{ color: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>
                        {m.total}
                      </p>
                      <p className="text-[10px] text-muted-foreground">ações</p>
                    </div>
                  ))}
                </div>

                {/* Bar chart */}
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Ações" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell
                          key={entry.name}
                          fill={MEMBER_COLORS[i % MEMBER_COLORS.length]}
                          opacity={selectedUserId === "all" || memberTotals[i]?.userId === selectedUserId ? 1 : 0.3}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Activity Feed ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="size-4" />
            {selectedUserId !== "all"
              ? `Atividades de ${members.find((m) => m.id === selectedUserId)?.name ?? "membro"}`
              : "Todas as Atividades"}
            {logsData?.total != null && (
              <span className="text-xs font-normal text-muted-foreground">
                ({logsData.total} registros)
              </span>
            )}
          </h3>
        </div>

        <div className="rounded-xl border overflow-hidden divide-y">
          {logsLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-28 shrink-0" />
              </div>
            ))
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma atividade encontrada para os filtros selecionados.
            </div>
          ) : (
            <>
              {logs.map((log) => {
                const memberInfo = members.find((m) => m.id === log.userId);
                const appLabel = APP_LABELS[log.appSlug] ?? log.appSlug;
                return (
                  <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/10 transition-colors min-w-0">
                    {/* Avatar */}
                    <Avatar className="size-7 shrink-0">
                      <AvatarImage src={log.userImage ?? ""} alt={log.userName} />
                      <AvatarFallback className="text-[10px]">{initials(log.userName)}</AvatarFallback>
                    </Avatar>

                    {/* Nome */}
                    <span className="text-xs font-semibold shrink-0 max-w-[100px] truncate">
                      {log.userName}
                    </span>

                    {/* Role */}
                    {memberInfo && <RoleBadge role={memberInfo.role} />}

                    {/* Separator */}
                    <span className="text-muted-foreground/30 shrink-0">·</span>

                    {/* App */}
                    <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0 whitespace-nowrap">
                      {appLabel}
                    </span>

                    {/* Separator */}
                    <span className="text-muted-foreground/30 shrink-0">·</span>

                    {/* Ação */}
                    <span className="text-xs text-foreground/80 flex-1 truncate">
                      {log.actionLabel}
                    </span>

                    {/* Data */}
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 ml-auto pl-2">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                );
              })}

              {logs.length >= logsLimit && (logsData?.total ?? 0) > logsLimit && (
                <div className="py-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setLogsLimit((v) => v + 50)} className="text-xs">
                    Carregar mais ({(logsData?.total ?? 0) - logsLimit} restantes)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
