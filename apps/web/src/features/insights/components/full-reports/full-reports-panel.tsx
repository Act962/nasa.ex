"use client";

import { useState, useMemo } from "react";
import { useOrgRole } from "@/hooks/use-org-role";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, Users, Briefcase, Target, MessageSquare, Activity } from "lucide-react";
import { DateRangeTimePicker } from "@/features/insights/components/activities/date-range-time-picker";
import { MemberMultiSelect } from "./member-multi-select";
import { WorkspacesReport } from "./workspaces-report";
import { TrackingsReport } from "./trackings-report";
import { AttendantsReport } from "./attendants-report";
import { MemberActivityReport } from "./member-activity-report";

export function FullReportsPanel() {
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
  const [activeTab, setActiveTab] = useState("workspaces");

  const startISO = useMemo(
    () =>
      (dateRange.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString(),
    [dateRange.from],
  );
  const endISO = useMemo(
    () => (dateRange.to ?? new Date()).toISOString(),
    [dateRange.to],
  );

  if (isSingle) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
        <div className="size-14 rounded-full bg-amber-100 flex items-center justify-center">
          <BarChart3 className="size-7 text-amber-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Acesso Restrito</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Apenas Master, Adm e Moderador podem visualizar os relatórios completos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="size-6" /> Relatórios completos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Análise detalhada por Workspace, Tracking, Atendente e Membro.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <DateRangeTimePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
        />
        <MemberMultiSelect value={memberIds} onChange={setMemberIds} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 md:grid-cols-4 sm:w-auto sm:inline-flex">
          <TabsTrigger value="workspaces" className="text-xs gap-1.5">
            <Briefcase className="size-3.5" /> Workspaces
          </TabsTrigger>
          <TabsTrigger value="trackings" className="text-xs gap-1.5">
            <Target className="size-3.5" /> Trackings
          </TabsTrigger>
          <TabsTrigger value="attendants" className="text-xs gap-1.5">
            <MessageSquare className="size-3.5" /> Atendentes
          </TabsTrigger>
          <TabsTrigger value="members" className="text-xs gap-1.5">
            <Users className="size-3.5" /> Membros
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspaces" className="mt-4">
          <WorkspacesReport from={startISO} to={endISO} memberIds={memberIds} />
        </TabsContent>

        <TabsContent value="trackings" className="mt-4">
          <TrackingsReport from={startISO} to={endISO} memberIds={memberIds} />
        </TabsContent>

        <TabsContent value="attendants" className="mt-4">
          <AttendantsReport from={startISO} to={endISO} memberIds={memberIds} />
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <MemberActivityReport from={startISO} to={endISO} memberIds={memberIds} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
