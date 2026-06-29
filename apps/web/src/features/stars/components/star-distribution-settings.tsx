"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, Layers, Sliders, Star, CheckCircle2,
  ChevronDown, ChevronUp, Info,
} from "lucide-react";

type Mode = "org" | "equal" | "custom";

const MODES: { id: Mode; label: string; desc: string; icon: React.ElementType }[] = [
  {
    id:    "org",
    label: "Pool compartilhado",
    desc:  "Toda a equipe compartilha o saldo da organização. Sem limites individuais.",
    icon:  Layers,
  },
  {
    id:    "equal",
    label: "Divisão igualitária",
    desc:  "O saldo mensal do plano é dividido automaticamente em partes iguais entre todos os usuários.",
    icon:  Users,
  },
  {
    id:    "custom",
    label: "Personalizado por usuário",
    desc:  "Defina manualmente o orçamento em Stars para cada membro da equipe.",
    icon:  Sliders,
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function StarDistributionSettings() {
  const qc = useQueryClient();
  const qKey = orpc.stars.getDistribution.queryOptions();

  const { data, isLoading } = useQuery(qKey);

  const [editBudgets, setEditBudgets] = useState<Record<string, number>>({});
  const [showMembers, setShowMembers] = useState(false);

  const { mutate: setMode, isPending: isSettingMode } = useMutation({
    ...orpc.stars.setDistribution.mutationOptions(),
    onSuccess: () => { toast.success("Modo de distribuição atualizado!"); qc.invalidateQueries(qKey); },
    onError:   (e) => toast.error(e.message),
  });

  const { mutate: saveBudget, isPending: isSavingBudget } = useMutation({
    ...orpc.stars.setMemberBudget.mutationOptions(),
    onSuccess: () => { toast.success("Orçamento salvo!"); qc.invalidateQueries(qKey); },
    onError:   (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-zinc-800 animate-pulse" />
        ))}
      </div>
    );
  }

  const mode             = data?.mode            ?? "org";
  const planStars        = data?.planMonthlyStars ?? 0;
  const memberCount      = data?.memberCount      ?? 0;
  const equalShare       = data?.equalShare       ?? 0;
  const members          = data?.members          ?? [];

  const totalCustomBudget = members.reduce((s, m) => {
    const edited = editBudgets[m.userId];
    return s + (edited !== undefined ? edited : m.monthlyBudget);
  }, 0);

  return (
    <div className="space-y-5">
      {/* Plan info bar */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-400/8 border border-yellow-400/20">
        <Star className="size-4 text-yellow-400 shrink-0" />
        <p className="text-sm text-white/70">
          Plano atual: <strong className="text-white">{planStars.toLocaleString("pt-BR")} ★/mês</strong>
          {memberCount > 0 && (
            <> · <strong className="text-white">{memberCount}</strong> usuários ·{" "}
              divisão igual: <strong className="text-violet-300">{equalShare.toLocaleString("pt-BR")} ★/usuário</strong>
            </>
          )}
        </p>
      </div>

      {/* Mode selector */}
      <div className="grid gap-3">
        {MODES.map(({ id, label, desc, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode({ mode: id })}
            disabled={isSettingMode}
            className={cn(
              "flex items-start gap-4 p-4 rounded-xl border text-left transition-all",
              mode === id
                ? "border-violet-500/60 bg-violet-500/10"
                : "border-zinc-700/50 bg-zinc-900 hover:border-zinc-600/60",
            )}
          >
            <div className={cn(
              "mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
              mode === id ? "bg-violet-600/30" : "bg-zinc-800",
            )}>
              <Icon className={cn("size-4", mode === id ? "text-violet-300" : "text-zinc-500")} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={cn("font-semibold text-sm", mode === id ? "text-white" : "text-zinc-300")}>
                  {label}
                </p>
                {mode === id && (
                  <CheckCircle2 className="size-3.5 text-violet-400 shrink-0" />
                )}
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Equal mode info */}
      {mode === "equal" && members.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/8 border border-blue-500/20">
          <Info className="size-3.5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-200/70 leading-relaxed">
            Cada usuário recebe automaticamente{" "}
            <strong className="text-blue-300">{equalShare.toLocaleString("pt-BR")} ★/mês</strong>.
            O orçamento é recalculado sempre que houver mudança de plano ou no número de membros.
          </p>
        </div>
      )}

      {/* Custom mode: member budget table */}
      {(mode === "custom" || mode === "equal") && members.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowMembers(!showMembers)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            {showMembers ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {showMembers ? "Ocultar" : "Ver"} orçamentos por usuário
          </button>

          {showMembers && (
            <div className="space-y-2">
              {/* Summary row */}
              {mode === "custom" && (
                <div className="flex items-center justify-between text-xs text-zinc-500 px-1 pb-1 border-b border-zinc-700/40">
                  <span>Total alocado</span>
                  <span className={cn(
                    "font-semibold",
                    totalCustomBudget > planStars ? "text-red-400" : "text-emerald-400"
                  )}>
                    {totalCustomBudget.toLocaleString("pt-BR")} / {planStars.toLocaleString("pt-BR")} ★
                  </span>
                </div>
              )}

              {members.map((m) => {
                const budget   = editBudgets[m.userId] ?? m.monthlyBudget;
                const usagePct = budget > 0 ? Math.min(100, (m.currentUsage / budget) * 100) : 0;
                const isEdited = editBudgets[m.userId] !== undefined && editBudgets[m.userId] !== m.monthlyBudget;

                return (
                  <div
                    key={m.userId}
                    className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-700/40"
                  >
                    {/* Avatar placeholder */}
                    <div className="w-7 h-7 rounded-full bg-violet-600/30 border border-violet-700/50 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-violet-300 uppercase">
                        {m.userName.charAt(0)}
                      </span>
                    </div>

                    {/* Name + usage */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{m.userName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="flex-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              usagePct >= 90 ? "bg-red-500"
                              : usagePct >= 70 ? "bg-amber-500"
                              : "bg-violet-500"
                            )}
                            style={{ width: `${usagePct}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-zinc-500 shrink-0">
                          {m.currentUsage.toLocaleString("pt-BR")} ★ usados
                        </span>
                      </div>
                    </div>

                    {/* Budget input (custom mode only) */}
                    {mode === "custom" ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input
                          type="number"
                          min={0}
                          value={budget}
                          onChange={(e) =>
                            setEditBudgets((prev) => ({
                              ...prev,
                              [m.userId]: Number(e.target.value) || 0,
                            }))
                          }
                          className="w-20 h-7 text-xs bg-zinc-800 border-zinc-700 text-white text-right"
                        />
                        <span className="text-[10px] text-zinc-500">★</span>
                        {isEdited && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              saveBudget({ userId: m.userId, monthlyBudget: budget })
                            }
                            disabled={isSavingBudget}
                            className="h-7 px-2 text-[10px] text-violet-400 hover:text-white hover:bg-violet-600/20"
                          >
                            Salvar
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-violet-300 shrink-0">
                        {equalShare.toLocaleString("pt-BR")} ★
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
