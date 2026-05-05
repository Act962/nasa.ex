"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useOrgRole } from "@/hooks/use-org-role";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Activity, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_LABELS } from "@/lib/activity-constants";
import { CompanyMultiSelect } from "./company-multi-select";
import { NowPanel } from "./now-panel";
import { StatsCards } from "./stats-cards";
import { ActivityTable } from "./activity-table";
import { DateRangeTimePicker } from "./date-range-time-picker";
import { MemberMultiSelect } from "@/features/insights/components/full-reports/member-multi-select";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
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
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer select-none transition-colors",
        count > 0
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
          : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900/30",
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full shrink-0",
          count > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-300",
        )}
      />
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
            <div
              key={u.id}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50"
            >
              <div className="relative shrink-0">
                <Avatar className="size-7">
                  <AvatarImage src={u.userImage ?? ""} alt={u.userName} />
                  <AvatarFallback className="text-[10px]">
                    {initials(u.userName)}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 border-2 border-background" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{u.userName}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {u.userEmail}
                </p>
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

export function ActivitiesPanel() {
  const { isSingle } = useOrgRole();

  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 0, 0);
    return { from: start, to: end };
  });
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>("all");
  const [orgIds, setOrgIds] = useState<string[]>([]);
  const [logsLimit, setLogsLimit] = useState(50);
  const [activeTab, setActiveTab] = useState("geral");

  const startDate = useMemo(
    () =>
      (dateRange.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString(),
    [dateRange.from],
  );
  const endDate = useMemo(
    () => (dateRange.to ?? new Date()).toISOString(),
    [dateRange.to],
  );

  if (isSingle) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
        <div className="size-14 rounded-full bg-amber-100 flex items-center justify-center">
          <Activity className="size-7 text-amber-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Acesso Restrito</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Apenas Master, Adm e Moderador podem visualizar o histórico de
            atividades.
          </p>
        </div>
      </div>
    );
  }

  const handleExport = () => {
    const params = new URLSearchParams();
    if (memberIds.length > 0) params.set("userIds", memberIds.join(","));
    if (selectedApp !== "all") params.set("appSlug", selectedApp);
    params.set("from", startDate);
    params.set("to", endDate);
    if (orgIds.length > 0) params.set("orgIds", orgIds.join(","));
    window.open(`/api/insights/activity/export?${params.toString()}`, "_blank");
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="size-6" /> Atividades
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Rastreamento completo de todas as ações realizadas pelos membros da
            organização.
          </p>
        </div>
        <OnlineBadge />
      </div>

      <NowPanel orgIds={orgIds} />

      <StatsCards
        orgIds={orgIds}
        from={startDate}
        to={endDate}
        memberIds={memberIds}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="size-3.5" /> Filtros:
        </div>

        <CompanyMultiSelect value={orgIds} onChange={setOrgIds} />

        <DateRangeTimePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
        />

        <MemberMultiSelect value={memberIds} onChange={setMemberIds} />

        <Select value={selectedApp} onValueChange={setSelectedApp}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue placeholder="Todos os apps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os apps</SelectItem>
            {Object.entries(APP_LABELS).map(([slug, label]) => (
              <SelectItem key={slug} value={slug}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(memberIds.length > 0 || selectedApp !== "all" || orgIds.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setMemberIds([]);
              setSelectedApp("all");
              setOrgIds([]);
            }}
          >
            Limpar
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 sm:w-auto sm:inline-flex">
          <TabsTrigger value="geral" className="text-xs">
            Geral
          </TabsTrigger>
          <TabsTrigger value="atendimento" className="text-xs">
            Atendimento
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="text-xs">
            Pipeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-4">
          <ActivityTable
            userIds={memberIds}
            appSlug={selectedApp !== "all" ? selectedApp : undefined}
            startDate={startDate}
            endDate={endDate}
            limit={logsLimit}
            onLoadMore={() => setLogsLimit((v) => v + 50)}
            onExport={handleExport}
          />
        </TabsContent>

        <TabsContent value="atendimento" className="mt-4">
          <ActivityTable
            userIds={memberIds}
            appSlug="chat"
            startDate={startDate}
            endDate={endDate}
            limit={logsLimit}
            onLoadMore={() => setLogsLimit((v) => v + 50)}
            onExport={handleExport}
          />
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4">
          <ActivityTable
            userIds={memberIds}
            appSlug="tracking"
            startDate={startDate}
            endDate={endDate}
            limit={logsLimit}
            onLoadMore={() => setLogsLimit((v) => v + 50)}
            onExport={handleExport}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
