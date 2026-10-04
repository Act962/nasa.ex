"use client";

import { useMemo } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Minus, Plus } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { usePlannerCalendarPosts, usePlannerMoments } from "../../hooks/use-planner-calendar";
import { usePlannerGoals, useSetPlannerGoal } from "../../hooks/use-planner-planning";
import { ClientAvatar } from "./client-avatar";
import { POST_TYPE_META, POST_TYPES } from "./planner-v2-utils";
import type { ComposerRequest, PlannerClient } from "./planner-v2-types";

/** Metas da semana e Momentos (datas comemorativas e eventos de campanha) do Dashboard do Planner. */

const MOMENTS_WINDOW_DAYS = 75;

export function MomentsList({ organizationIds, onCreate }: { organizationIds?: string[]; onCreate: (request: ComposerRequest) => void }) {
  const range = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return { from, to: addDays(from, MOMENTS_WINDOW_DAYS) };
  }, []);
  const { moments, campaignEvents, isLoading } = usePlannerMoments({ organizationIds, ...range });
  if (isLoading) return <OrbitaSpinner className="mx-auto my-6 size-5" />;
  const items = [
    ...moments.map((moment) => ({ id: moment.key, label: moment.label, date: new Date(moment.date), momentKey: moment.key, hint: "Data comemorativa" })),
    ...campaignEvents.map((campaignEvent) => ({ id: campaignEvent.id, label: campaignEvent.title, date: new Date(campaignEvent.date), momentKey: undefined, hint: campaignEvent.campaignTitle })),
  ].sort((left, right) => left.date.getTime() - right.date.getTime());
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma data nos próximos {MOMENTS_WINDOW_DAYS} dias.</p>;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-panel p-2.5">
          <span className="grid w-10 shrink-0 text-center">
            <span className="text-lg leading-none font-bold">{format(item.date, "d")}</span>
            <span className="text-[10px] uppercase text-muted-foreground">{format(item.date, "MMM", { locale: ptBR })}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{item.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
          </span>
          <button
            type="button"
            onClick={() => onCreate({ mode: "create", type: "STATIC", intendedAt: addDays(item.date, -1), momentKey: item.momentKey, title: item.label })}
            className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background"
          >
            Criar post
          </button>
        </div>
      ))}
    </div>
  );
}

export function GoalsList({ organizationIds, clients }: { organizationIds?: string[]; clients: PlannerClient[] }) {
  const weekRange = useMemo(() => {
    const from = startOfWeek(new Date(), { weekStartsOn: 0 });
    return { from, to: addDays(from, 7) };
  }, []);
  const { goals } = usePlannerGoals(organizationIds);
  const { posts } = usePlannerCalendarPosts({ organizationIds, ...weekRange });
  const setGoal = useSetPlannerGoal();
  const visibleClients = organizationIds?.length ? clients.filter((client) => organizationIds.includes(client.id)) : clients;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Quantos conteúdos por semana cada cliente deve ter. Conta o que está programado ou publicado nesta semana.</p>
      {visibleClients.map((client) => (
        <div key={client.id} className="rounded-2xl bg-panel p-2.5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ClientAvatar name={client.name} logo={client.logo} clientIndex={clients.indexOf(client)} />
            <span className="truncate">{client.name}</span>
          </div>
          {POST_TYPES.map((type) => {
            const goal = goals.find((candidate) => candidate.organizationId === client.id && candidate.postType === type);
            const doneCount = posts.filter(
              (post) => post.organizationId === client.id && post.type === type && (post.status === "SCHEDULED" || post.status === "PUBLISHED"),
            ).length;
            const goalCount = goal?.perWeek ?? 0;
            return (
              <div key={type} className="flex items-center gap-2 py-0.5 text-xs">
                <span className="w-16 text-muted-foreground">{POST_TYPE_META[type].label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-knob">
                  <span className="block h-full rounded-full bg-success" style={{ width: goalCount ? `${Math.min(100, (doneCount / goalCount) * 100)}%` : "0%" }} />
                </span>
                <span className="w-10 text-right tabular-nums">{doneCount}/{goalCount}</span>
                {client.permissions.canSchedule && (
                  <span className="flex gap-0.5">
                    <button type="button" aria-label="Diminuir meta" disabled={goalCount === 0} onClick={() => setGoal.mutate({ organizationId: client.id, postType: type, perWeek: goalCount - 1 })} className="grid size-5 place-items-center rounded-full bg-knob/60 disabled:opacity-30"><Minus className="size-3" /></button>
                    <button type="button" aria-label="Aumentar meta" onClick={() => setGoal.mutate({ organizationId: client.id, postType: type, perWeek: goalCount + 1 })} className="grid size-5 place-items-center rounded-full bg-knob/60"><Plus className="size-3" /></button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
