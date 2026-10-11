"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { executionNodes, triggerNodes } from "@/features/tracking-executions/lib/node-options";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import {
  useAutomationsOverview,
  useToggleCommentsAutomation,
  useToggleTrackingFlow,
  useToggleWorkspaceFlow,
} from "../hooks/use-automations-hub";
import { ChannelLogo, type AutomationChannel } from "./channel-logo";

// Lista das automações da empresa (spec 0090, RF-1 a RF-4). Cada linha abre no editor que a
// automação já tem; o interruptor usa a rota de ativação de cada tipo.

type StateFilter = "all" | "active" | "problem";

const STEP_LABELS = new Map<string, string>([...triggerNodes, ...executionNodes].map((option) => [String(option.type), option.label]));
const ORIGIN_LABEL = { tracking: "Tracking", workspace: "Workspace", comments: "Comments" } as const;

interface HubAutomationRow {
  id: string;
  name: string;
  isActive: boolean;
  origin: "tracking" | "workspace" | "comments";
  originName: string;
  href: string;
  channel: AutomationChannel;
  stepTypes: string[];
  hasPredictedError: boolean;
}

function describeSteps(automation: HubAutomationRow): string {
  const steps = automation.stepTypes.map((stepType) => STEP_LABELS.get(stepType) ?? "passo").join(" → ");
  const origin = automation.origin === "comments" ? "Comments" : `${ORIGIN_LABEL[automation.origin]} ${automation.originName}`;
  return steps ? `${origin} · ${steps}` : origin;
}

export function AutomationsList({ onNavigate, maxRows }: { onNavigate?: () => void; maxRows?: number }) {
  const { data, isLoading } = useAutomationsOverview();
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const toggleTrackingFlow = useToggleTrackingFlow();
  const toggleWorkspaceFlow = useToggleWorkspaceFlow();
  const toggleCommentsAutomation = useToggleCommentsAutomation();

  const automations = useMemo(() => (data?.automations ?? []) as HubAutomationRow[], [data]);
  const counts = {
    all: automations.length,
    active: automations.filter((automation) => automation.isActive).length,
    problem: automations.filter((automation) => automation.hasPredictedError).length,
  };
  const visible = automations
    .filter((automation) => (stateFilter === "active" ? automation.isActive : stateFilter === "problem" ? automation.hasPredictedError : true))
    .filter((automation) => automation.name.toLowerCase().includes(search.trim().toLowerCase()));
  const rows = maxRows ? visible.slice(0, maxRows) : visible;
  const isToggling = toggleTrackingFlow.isPending || toggleWorkspaceFlow.isPending || toggleCommentsAutomation.isPending;

  const handleToggle = (automation: HubAutomationRow, isActive: boolean) => {
    const callbacks = {
      onSuccess: () => toast.success(isActive ? "Automação ligada" : "Automação desligada"),
      onError: (error: Error) => toast.error(error.message || "Não foi possível alterar"),
    };
    if (automation.origin === "tracking") toggleTrackingFlow.mutate({ workflowId: automation.id, isActive }, callbacks);
    else if (automation.origin === "workspace") toggleWorkspaceFlow.mutate({ workflowId: automation.id, isActive }, callbacks);
    else toggleCommentsAutomation.mutate({ id: automation.id, isActive }, callbacks);
  };

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const shortcuts = [
    { label: "Gatilhos de lead", count: data?.shortcuts.leadTriggers ?? 0, href: "/tracking-chat" },
    { label: "Inatividade", count: data?.shortcuts.idleAutomations ?? 0, href: "/tracking" },
    { label: "Comandos do Astro", count: data?.shortcuts.astroCommands ?? 0, href: "/astro?aba=comandos" },
    { label: "Alertas", count: data?.shortcuts.alertRules ?? 0, href: "/astro?aba=alertas" },
  ];
  const filters: { value: StateFilter; label: string }[] = [
    { value: "all", label: `Todos · ${counts.all}` },
    { value: "active", label: `Ativos · ${counts.active}` },
    { value: "problem", label: `Com problema · ${counts.problem}` },
  ];

  return (
    <div className="space-y-3" data-guide={GUIDE_ANCHORS.automationsHubList.id}>
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar automação…" className="h-9" />
      <div className="flex flex-wrap gap-1.5">
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStateFilter(filter.value)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs transition",
              stateFilter === filter.value ? "border-primary text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          {automations.length === 0 ? "A empresa ainda não tem automações. Crie a primeira na aba Novo." : "Nenhuma automação com esse filtro."}
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map((automation) => (
            <li key={`${automation.origin}-${automation.id}`} className="flex items-center gap-3 py-2.5">
              <ChannelLogo channel={automation.channel} />
              <Link href={automation.href} onClick={onNavigate} className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{automation.name}</span>
                  {automation.hasPredictedError && (
                    <span className="shrink-0 rounded-full border border-destructive/50 px-1.5 text-[10px] font-normal text-destructive">
                      com problema
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{describeSteps(automation)}</span>
              </Link>
              <Switch
                checked={automation.isActive}
                disabled={isToggling}
                onCheckedChange={(isActive) => handleToggle(automation, isActive)}
                aria-label={automation.isActive ? `Desligar ${automation.name}` : `Ligar ${automation.name}`}
              />
            </li>
          ))}
        </ul>
      )}
      {maxRows && visible.length > maxRows && (
        <p className="text-center text-xs text-muted-foreground">e mais {visible.length - maxRows}</p>
      )}

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {shortcuts.map((shortcut) => (
          <Link key={shortcut.label} href={shortcut.href} onClick={onNavigate} className="rounded-xl border px-2.5 py-2 text-[11px] text-muted-foreground transition hover:bg-muted">
            <span className="block text-base font-semibold text-foreground">{shortcut.count}</span>
            {shortcut.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
