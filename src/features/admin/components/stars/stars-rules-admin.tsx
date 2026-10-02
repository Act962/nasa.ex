"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { Plus, Settings, Star, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

/**
 * Regras de Stars **globais** — refletem em TODAS as orgs.
 *
 * Hoje armazenadas no model `AppStarCost` (com `category="action"`).
 * Quando o admin edita o custo de uma ação, o próximo `chargeStarsByAction`
 * em qualquer org consulta o novo valor.
 */

interface OrgOption { id: string; name: string; slug: string; logo?: string | null }

const CATEGORY_LABEL: Record<string, string> = {
  leads: "CRM / Leads",
  ai: "IA & ÓRBITA Command",
  forge: "Forge",
  planner: "ÓRBITA Planner",
  automation: "Workflows & Automações",
  agenda: "Agenda",
  chat: "Chat & Mensagens",
  forms: "Formulários",
  nbox: "N.Box",
  workspace: "Workspace",
  integration: "Integrações",
  insights: "Analytics & Insights",
  system: "Sistema / Alertas",
  custom: "Personalizada",
};

interface PricedRule {
  stars: number;
  unit: string | null;
  unitCost: number | null;
  unitDivisor: number;
}

const UNIT_LABEL: Record<string, string> = {
  token: "tokens",
  minute: "min",
  second: "s",
  mb: "MB",
  image: "imagem",
  message: "mensagem",
  conversation: "conversa",
};

/**
 * Ação cobrada por quantidade tem `stars` (o campo fixo) igual a zero — o
 * preço dela é `unitCost` por `unitDivisor` unidades. Exibir só `stars` fazia
 * o painel anunciar como gratuita uma ação que cobra.
 */
function isUnitPriced(rule: PricedRule): boolean {
  return rule.unit !== null && rule.unitCost !== null;
}

function formatRulePrice(rule: PricedRule): string {
  if (!isUnitPriced(rule)) return String(rule.stars);
  const unit = UNIT_LABEL[rule.unit!] ?? rule.unit!;
  const scale =
    rule.unitDivisor >= 1000
      ? `${rule.unitDivisor / 1000}k `
      : rule.unitDivisor > 1
        ? `${rule.unitDivisor} `
        : "";
  return `${rule.unitCost}/${scale}${unit}`;
}


function useGlobalStarRules() {
  return useQuery({
    ...orpc.admin.adminGetStarRules.queryOptions({ input: {} }),
    queryKey: ["admin", "starRules", "global"],
    staleTime: 30_000,
  });
}

function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { action: string; label: string; stars: number }) =>
      orpc.admin.adminCreateStarRule.call(vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "starRules", "global"] });
      toast.success("Regra criada — vale pra todas as orgs!");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao criar";
      toast.error(msg);
    },
  });
}

function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      stars?: number;
      isActive?: boolean;
      label?: string;
    }) =>
      orpc.admin.adminUpdateStarRule.call({
        id: vars.id,
        stars: vars.stars,
        isActive: vars.isActive,
        label: vars.label,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "starRules", "global"] });
    },
  });
}

function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      orpc.admin.adminDeleteStarRule.call({ id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "starRules", "global"] });
      toast.success("Regra removida");
    },
  });
}

interface Props {
  /** Mantido pra compat com chamada existente — não é mais usado. */
  allOrgs?: OrgOption[];
}

export function StarsRulesAdmin({ allOrgs: _allOrgs }: Props) {
  const { data: rules, isLoading } = useGlobalStarRules();
  const { mutateAsync: updateRule } = useUpdateRule();
  const { mutateAsync: deleteRule } = useDeleteRule();
  const { mutateAsync: createRule, isPending: creating } = useCreateRule();

  const [showCreate, setShowCreate] = useState(false);
  const [newAction, setNewAction] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newStars, setNewStars] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStars, setEditStars] = useState(0);
  const [editLabel, setEditLabel] = useState("");

  const handleCreate = async () => {
    if (!newAction.trim() || !newLabel.trim()) {
      return toast.error("Preencha action e label");
    }
    await createRule({
      action: newAction.toLowerCase().replace(/\s+/g, "_"),
      label: newLabel,
      stars: newStars,
    });
    setShowCreate(false);
    setNewAction("");
    setNewLabel("");
    setNewStars(1);
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Remover a regra "${label}"? Operações que dependiam dela ficam grátis.`)) {
      return;
    }
    await deleteRule(id);
  };

  const startEditing = (rule: { id: string; stars: number; label: string }) => {
    setEditingId(rule.id);
    setEditStars(rule.stars);
    setEditLabel(rule.label);
  };

  const saveEdit = async (id: string) => {
    await updateRule({ id, stars: editStars, label: editLabel });
    setEditingId(null);
    toast.success("Regra atualizada");
  };

  // Group by category
  const grouped: Record<string, NonNullable<typeof rules>> = {};
  for (const rule of rules ?? []) {
    const cat = rule.category ?? "custom";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat]!.push(rule);
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/50">
        <Settings className="w-4 h-4 text-warning" />
        <p className="text-sm font-semibold text-foreground">
          Regras de Stars — Globais
        </p>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Aplica em todas as orgs
        </span>
      </div>
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-12 rounded-lg bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([cat, catRules]) => (
              <div key={cat}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 px-1">
                  {CATEGORY_LABEL[cat] ?? cat}
                </p>
                <div className="space-y-1.5">
                  {catRules.map((rule) => {
                    const isEditing = editingId === rule.id;
                    return (
                      <div
                        key={rule.id}
                        className={cn(
                          "rounded-lg border transition-all px-3 py-2.5 flex items-center gap-3",
                          rule.isActive
                            ? "bg-muted/50 border-line"
                            : "bg-card border-border opacity-50",
                        )}
                      >
                        <button
                          disabled={isUnitPriced(rule)}
                          onClick={() =>
                            updateRule({
                              id: rule.id,
                              isActive: !rule.isActive,
                            })
                          }
                          className={cn(
                            "w-8 h-5 rounded-full transition-all shrink-0",
                            rule.isActive ? "bg-primary" : "bg-knob",
                            isUnitPriced(rule) && "cursor-not-allowed",
                          )}
                          title={
                            isUnitPriced(rule)
                              ? "Cobrança por quantidade — ligar/desligar por aqui gravaria um custo fixo e trocaria o modelo de cobrança"
                              : rule.isActive
                                ? "Desativar regra"
                                : "Ativar regra"
                          }
                        >
                          <div
                            className={cn(
                              "w-4 h-4 rounded-full bg-background shadow mx-0.5 transition-transform",
                              rule.isActive ? "translate-x-3" : "",
                            )}
                          />
                        </button>

                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <input
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              className="w-full text-sm bg-knob border border-line rounded px-2 py-1 text-foreground"
                            />
                          ) : (
                            <p className="text-sm text-foreground truncate">
                              {rule.label}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {rule.action}
                          </p>
                        </div>

                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={editStars}
                            onChange={(e) =>
                              setEditStars(parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-sm bg-knob border border-line rounded px-2 py-1 text-warning font-bold text-right"
                          />
                        ) : (
                          <span
                            className="text-sm font-bold text-warning shrink-0 flex items-center gap-1"
                            title={
                              isUnitPriced(rule)
                                ? `Cobrança por quantidade — mínimo ${rule.minCharge}★${rule.maxCharge ? `, teto ${rule.maxCharge}★` : ""}`
                                : undefined
                            }
                          >
                            <Star className="w-3 h-3" />
                            {formatRulePrice(rule)}
                          </span>
                        )}

                        {isEditing ? (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => saveEdit(rule.id)}
                              className="text-[10px] bg-primary text-primary-foreground px-2 py-1 rounded"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              disabled={isUnitPriced(rule)}
                              onClick={() => startEditing(rule)}
                              title={
                                isUnitPriced(rule)
                                  ? "Cobrança por quantidade — o editor daqui só escreve custo fixo"
                                  : "Editar"
                              }
                              className={cn(
                                "h-6 w-6 flex items-center justify-center rounded text-muted-foreground",
                                isUnitPriced(rule)
                                  ? "opacity-40 cursor-not-allowed"
                                  : "hover:text-foreground hover:bg-knob",
                              )}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(rule.id, rule.label)}
                              title="Remover"
                              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {showCreate ? (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 space-y-2">
            <p className="text-xs font-semibold text-warning">
              Nova regra global
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Identificador (ex: astro_prompt)"
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                className="col-span-2 text-xs bg-muted border border-line rounded-lg px-2 py-1.5 text-foreground"
              />
              <input
                placeholder="Descrição (ex: Executar Astro IA)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="col-span-2 text-xs bg-muted border border-line rounded-lg px-2 py-1.5 text-foreground"
              />
              <input
                type="number"
                min={0}
                placeholder="Custo em ★"
                value={newStars}
                onChange={(e) => setNewStars(parseInt(e.target.value) || 0)}
                className="text-xs bg-muted border border-line rounded-lg px-2 py-1.5 text-foreground"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCreate(false)}
                className="text-xs text-muted-foreground hover:text-foreground px-3 py-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {creating ? "..." : "Criar"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-warning/30 text-warning hover:bg-warning/10 transition-all text-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Nova regra global
          </button>
        )}
      </div>
    </div>
  );
}
