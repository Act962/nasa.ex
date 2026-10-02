"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Star, Users, Layers, Sliders, ChevronDown, ChevronUp,
  Search, CheckCircle2, Building2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "org" | "equal" | "custom";

type OrgDist = {
  id:               string;
  name:             string;
  distributionMode: string;
  planName:         string | null;
  planMonthlyStars: number;
  memberCount:      number;
  equalShare:       number;
  members: {
    userId:        string;
    userName:      string;
    userEmail:     string;
    role:          string;
    monthlyBudget: number;
    currentUsage:  number;
  }[];
};

// ─── Mode configs ──────────────────────────────────────────────────────────────

const MODES: { id: Mode; label: string; short: string; icon: React.ElementType; desc: string }[] = [
  {
    id:    "org",
    label: "Pool compartilhado",
    short: "Pool",
    icon:  Layers,
    desc:  "Toda a equipe usa o saldo da empresa livremente. Sem limites individuais.",
  },
  {
    id:    "equal",
    label: "Igualitário",
    short: "Igual",
    icon:  Users,
    desc:  "Stars mensais divididas em partes iguais entre todos os usuários automaticamente.",
  },
  {
    id:    "custom",
    label: "Individual",
    short: "Individual",
    icon:  Sliders,
    desc:  "Defina manualmente o orçamento em Stars para cada membro da equipe.",
  },
];

const MODE_COLORS: Record<Mode, string> = {
  org:    "bg-success/15 text-success border-success/30",
  equal:  "bg-info/15 text-info border-info/30",
  custom: "bg-warning/15 text-warning border-warning/30",
};

// ─── Single Org Card ──────────────────────────────────────────────────────────

function OrgDistCard({ org }: { org: OrgDist }) {
  const qc   = useQueryClient();
  const qKey = orpc.admin.listOrgDistributions.queryOptions();

  const [expanded,    setExpanded]    = useState(false);
  const [editBudgets, setEditBudgets] = useState<Record<string, number>>({});

  const { mutate: setMode, isPending: settingMode } = useMutation({
    ...orpc.admin.setOrgDistribution.mutationOptions(),
    onSuccess: () => { toast.success(`Modo atualizado para ${org.name}`); qc.invalidateQueries(qKey); },
    onError:   (e) => toast.error(e.message),
  });

  const { mutate: saveBudget, isPending: savingBudget } = useMutation({
    ...orpc.admin.setOrgMemberBudget.mutationOptions(),
    onSuccess: () => { toast.success("Orçamento salvo!"); qc.invalidateQueries(qKey); setEditBudgets({}); },
    onError:   (e) => toast.error(e.message),
  });

  const currentMode = org.distributionMode as Mode;

  const totalAllocated = org.members.reduce((s, m) => {
    const edited = editBudgets[m.userId];
    return s + (edited !== undefined ? edited : m.monthlyBudget);
  }, 0);

  const isOverBudget = currentMode === "custom" && totalAllocated > org.planMonthlyStars;

  return (
    <div className="rounded-xl border border-line bg-card overflow-hidden">
      {/* Org header */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="w-9 h-9 rounded-xl bg-info/15 border border-info/30 flex items-center justify-center shrink-0">
          <Building2 className="size-4 text-info" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm truncate">{org.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {org.planName && (
              <span className="text-[10px] text-muted-foreground font-medium">
                {org.planName} · <span className="text-warning">{org.planMonthlyStars.toLocaleString("pt-BR")} ★/mês</span>
              </span>
            )}
            <span className="text-[10px] text-muted-foreground/70">
              {org.memberCount} {org.memberCount === 1 ? "membro" : "membros"}
            </span>
          </div>
        </div>
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
          MODE_COLORS[currentMode] ?? "bg-muted text-muted-foreground border-line",
        )}>
          {MODES.find((m) => m.id === currentMode)?.short ?? currentMode}
        </span>
      </div>

      {/* Mode selector */}
      <div className="px-5 py-4 space-y-3">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
          Modo de distribuição
        </p>

        <div className="grid grid-cols-3 gap-2">
          {MODES.map(({ id, label, icon: Icon, desc }) => (
            <button
              key={id}
              type="button"
              disabled={settingMode}
              onClick={() => setMode({ orgId: org.id, mode: id })}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all",
                currentMode === id
                  ? "border-info/30 bg-info/10"
                  : "border-line bg-muted/50 hover:border-muted-foreground/40 hover:bg-muted",
              )}
              title={desc}
            >
              {currentMode === id && (
                <div className="absolute top-1.5 right-1.5">
                  <CheckCircle2 className="size-3 text-info" />
                </div>
              )}
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                currentMode === id ? "bg-info/15" : "bg-knob",
              )}>
                <Icon className={cn("size-4", currentMode === id ? "text-info" : "text-muted-foreground")} />
              </div>
              <span className={cn(
                "text-[11px] font-semibold leading-tight",
                currentMode === id ? "text-foreground" : "text-muted-foreground",
              )}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Mode description */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {MODES.find((m) => m.id === currentMode)?.desc}
        </p>

        {/* Equal mode: auto stats */}
        {currentMode === "equal" && org.memberCount > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-info/10 border border-info/30">
            <Star className="size-3.5 text-info shrink-0" />
            <p className="text-xs text-info/70">
              Cada usuário recebe{" "}
              <strong className="text-info">{org.equalShare.toLocaleString("pt-BR")} ★/mês</strong>
              {" "}automaticamente.
            </p>
          </div>
        )}

        {/* Custom/Equal: member budgets toggle */}
        {org.memberCount > 0 && (currentMode === "custom" || currentMode === "equal") && (
          <>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {expanded ? "Ocultar" : "Ver"} orçamentos por membro
              {isOverBudget && (
                <span className="ml-2 text-[10px] text-destructive font-semibold">
                  ⚠ Total excede plano
                </span>
              )}
            </button>

            {expanded && (
              <div className="space-y-2 pt-1">
                {/* Custom: budget summary */}
                {currentMode === "custom" && (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-1 border-b border-line">
                    <span>Total alocado</span>
                    <span className={cn(
                      "font-bold",
                      isOverBudget ? "text-destructive" : "text-success",
                    )}>
                      {totalAllocated.toLocaleString("pt-BR")} / {org.planMonthlyStars.toLocaleString("pt-BR")} ★
                    </span>
                  </div>
                )}

                {org.members.map((m) => {
                  const budget   = editBudgets[m.userId] ?? m.monthlyBudget;
                  const display  = currentMode === "equal" ? org.equalShare : budget;
                  const usagePct = display > 0 ? Math.min(100, (m.currentUsage / display) * 100) : 0;
                  const isEdited = editBudgets[m.userId] !== undefined && editBudgets[m.userId] !== m.monthlyBudget;

                  return (
                    <div
                      key={m.userId}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/60 border border-line"
                    >
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full bg-info/15 border border-info/30 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-info uppercase">
                          {m.userName.charAt(0)}
                        </span>
                      </div>

                      {/* Name + role + usage bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-medium text-foreground truncate">{m.userName}</span>
                          <span className="text-[9px] text-muted-foreground/70 capitalize shrink-0">{m.role}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-knob rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                usagePct >= 90 ? "bg-destructive"
                                : usagePct >= 70 ? "bg-warning"
                                : "bg-info",
                              )}
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground/70 shrink-0 tabular-nums">
                            {m.currentUsage.toLocaleString("pt-BR")} ★ usados
                          </span>
                        </div>
                      </div>

                      {/* Budget: editable in custom, readonly in equal */}
                      {currentMode === "custom" ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Input
                            type="number"
                            min={0}
                            value={budget}
                            onChange={(e) =>
                              setEditBudgets((p) => ({ ...p, [m.userId]: Number(e.target.value) || 0 }))
                            }
                            className="w-20 h-7 text-xs bg-card border-line text-foreground text-right"
                          />
                          <span className="text-[10px] text-muted-foreground">★</span>
                          {isEdited && (
                            <Button
                              size="sm"
                              disabled={savingBudget}
                              onClick={() =>
                                saveBudget({ orgId: org.id, userId: m.userId, monthlyBudget: budget })
                              }
                              className="h-7 px-2 text-[10px] bg-primary hover:bg-primary/90 text-primary-foreground"
                            >
                              Salvar
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-info shrink-0 tabular-nums">
                          {org.equalShare.toLocaleString("pt-BR")} ★
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function StarsDistributionAdmin() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery(
    orpc.admin.listOrgDistributions.queryOptions()
  );

  const allOrgs = data?.orgs ?? [];

  const filtered = allOrgs.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  // Summary counts
  const counts = allOrgs.reduce(
    (acc, o) => {
      const m = o.distributionMode as Mode;
      acc[m] = (acc[m] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Sliders className="size-4 text-info" />
          Distribuição de Stars por Empresa
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure como as Stars mensais de cada empresa são distribuídas entre os usuários.
        </p>
      </div>

      {/* Mode legend */}
      <div className="grid grid-cols-3 gap-3">
        {MODES.map(({ id, label, icon: Icon, desc }) => (
          <div key={id} className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-line">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
              id === "org"    ? "bg-success/15" :
              id === "equal"  ? "bg-info/15" :
                                "bg-info/15",
            )}>
              <Icon className={cn(
                "size-4",
                id === "org"    ? "text-success" :
                id === "equal"  ? "text-info" :
                                  "text-info",
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                {counts[id] != null && (
                  <span className="text-[10px] text-muted-foreground bg-knob px-1.5 py-0.5 rounded-full">
                    {counts[id]}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empresa..."
          className="pl-9 bg-muted border-line text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Orgs list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 border border-dashed border-line rounded-xl">
          <Building2 className="size-10 text-muted-foreground/70" />
          <p className="text-muted-foreground text-sm">
            {search ? "Nenhuma empresa encontrada." : "Nenhuma empresa cadastrada."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((org) => (
            <OrgDistCard key={org.id} org={org} />
          ))}
        </div>
      )}
    </div>
  );
}
