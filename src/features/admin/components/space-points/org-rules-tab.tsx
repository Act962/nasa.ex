"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Bell, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  useAdminOrgRules,
  useAdminUpdateRule,
  useAdminCreateRule,
  usePopupTemplates,
} from "./hooks";

export const SP_CATEGORY_LABEL: Record<string, string> = {
  leads: "CRM / Leads & Tracking",
  forge: "Forge",
  automation: "Workflows & Automações",
  planner: "NASA Planner",
  ai: "NASA Command (IA)",
  agenda: "Agenda",
  workspace: "Workspace",
  form: "Formulários",
  nbox: "N.Box",
  chat: "Chat & Mensagens",
  integration: "Integrações",
  insights: "Analytics & Insights",
  system: "Sistema / Engajamento",
  penalty: "⚠️ Penalidades",
  custom: "Personalizada",
};

export function OrgRulesTab({ orgId }: { orgId: string }) {
  const { data: rules, isLoading } = useAdminOrgRules(orgId);
  const { data: popupTemplates = [] } = usePopupTemplates();
  const { mutateAsync: updateRule } = useAdminUpdateRule();
  const { mutateAsync: createRule, isPending: creating } = useAdminCreateRule();
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [editingPoints, setEditingPoints] = useState<Record<string, string>>(
    {},
  );
  const [showCreate, setShowCreate] = useState(false);
  const [newAction, setNewAction] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newPoints, setNewPoints] = useState(5);
  const [newCooldown, setNewCooldown] = useState("");
  const [newTemplateId, setNewTemplateId] = useState<string>("");

  const handleCreate = async () => {
    if (!newAction.trim() || !newLabel.trim())
      return toast.error("Preencha os campos obrigatórios");
    await createRule({
      orgId,
      action: newAction.toLowerCase().replace(/\s+/g, "_"),
      label: newLabel,
      points: newPoints,
      cooldownHours: newCooldown ? parseFloat(newCooldown) : null,
      popupTemplateId: newTemplateId || null,
    });
    setShowCreate(false);
    setNewAction("");
    setNewLabel("");
    setNewPoints(5);
    setNewCooldown("");
    setNewTemplateId("");
  };

  // Group by category
  const grouped: Record<string, NonNullable<typeof rules>> = {};
  for (const rule of rules ?? []) {
    const cat = (rule as { category?: string }).category ?? "custom";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat]!.push(rule);
  }

  const renderRule = (rule: NonNullable<typeof rules>[number]) => {
    const isExpanded = expandedRule === rule.id;
    const isPenalty = rule.points < 0;
    return (
      <div
        key={rule.id}
        className={cn(
          "rounded-lg border transition-all",
          rule.isActive
            ? isPenalty
              ? "bg-red-950/20 border-red-900/40"
              : "bg-zinc-800/50 border-zinc-700"
            : "bg-zinc-900 border-zinc-800 opacity-50",
        )}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button
            onClick={() =>
              updateRule({ id: rule.id, orgId, isActive: !rule.isActive })
            }
            className={cn(
              "w-8 h-5 rounded-full transition-all shrink-0",
              rule.isActive
                ? isPenalty
                  ? "bg-red-600"
                  : "bg-violet-600"
                : "bg-zinc-700",
            )}
          >
            <div
              className={cn(
                "w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-transform",
                rule.isActive ? "translate-x-3" : "",
              )}
            />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{rule.label}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] text-zinc-500 font-mono">
                {rule.action}
                {rule.cooldownHours ? ` · ⏱ ${rule.cooldownHours}h` : ""}
              </p>
              {rule.popupTemplateId && (
                <span className="flex items-center gap-0.5 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                  <Bell className="w-2.5 h-2.5" />{" "}
                  {rule.popupTemplateName ?? "Template"}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span
              className={`text-xs font-semibold ${isPenalty ? "text-red-400" : "text-violet-400"}`}
            >
              {rule.points > 0 ? "+" : ""}
            </span>
            <input
              type="number"
              value={editingPoints[rule.id] ?? rule.points}
              onChange={(e) =>
                setEditingPoints((p) => ({ ...p, [rule.id]: e.target.value }))
              }
              onBlur={() => {
                const val = parseInt(
                  editingPoints[rule.id] ?? String(rule.points),
                );
                if (!isNaN(val) && val !== rule.points) {
                  updateRule({ id: rule.id, orgId, points: val });
                }
                setEditingPoints((p) => {
                  const n = { ...p };
                  delete n[rule.id];
                  return n;
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setEditingPoints((p) => {
                    const n = { ...p };
                    delete n[rule.id];
                    return n;
                  });
                }
              }}
              className={`w-14 text-sm font-bold text-center bg-transparent border-b focus:outline-none focus:border-violet-500 transition-colors ${isPenalty ? "text-red-400 border-red-800" : "text-violet-300 border-zinc-700"}`}
            />
            <span
              className={`text-xs font-semibold ${isPenalty ? "text-red-400" : "text-violet-400"}`}
            >
              pts
            </span>
          </div>
          <button
            onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
            title="Configurar template"
            className={cn(
              "shrink-0 h-6 w-6 flex items-center justify-center rounded transition-all",
              rule.popupTemplateId
                ? "text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700",
            )}
          >
            <Bell className="w-3 h-3" />
          </button>
        </div>
        {isExpanded && (
          <div className="px-3 pb-3 pt-0 border-t border-zinc-700/50">
            <p className="text-[11px] text-zinc-400 mt-2 mb-1.5 font-medium flex items-center gap-1.5">
              <Bell className="w-3 h-3 text-amber-400" />
              Template de popup ao{" "}
              {isPenalty ? "aplicar penalidade" : "ganhar pontos"} nesta regra
            </p>
            <div className="flex items-center gap-2">
              <select
                value={rule.popupTemplateId ?? ""}
                onChange={(e) =>
                  updateRule({
                    id: rule.id,
                    orgId,
                    popupTemplateId: e.target.value || null,
                  })
                }
                className="flex-1 text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">— Sem popup —</option>
                {popupTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {rule.popupTemplateId && (
                <button
                  onClick={() =>
                    updateRule({ id: rule.id, orgId, popupTemplateId: null })
                  }
                  className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1.5 rounded hover:bg-red-500/10 transition-all shrink-0"
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-zinc-800 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, catRules]) => (
            <div key={cat}>
              <p
                className={cn(
                  "text-[10px] uppercase tracking-wider font-semibold mb-1.5 px-1 flex items-center gap-1",
                  cat === "penalty" ? "text-red-400" : "text-zinc-500",
                )}
              >
                {cat === "penalty" && <AlertTriangle className="w-3 h-3" />}
                {SP_CATEGORY_LABEL[cat] ?? cat}
              </p>
              <div className="space-y-1.5">{catRules.map(renderRule)}</div>
            </div>
          ))}
        </div>
      )}

      {showCreate ? (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-violet-400">Nova regra</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Identificador (ex: minha_acao)"
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              className="col-span-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <input
              placeholder="Descrição"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="col-span-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <input
              type="number"
              placeholder="Pontos (negativo = penalidade)"
              value={newPoints}
              onChange={(e) => setNewPoints(parseInt(e.target.value) || 0)}
              className="text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <input
              type="number"
              min={0}
              step={0.5}
              placeholder="Cooldown (h)"
              value={newCooldown}
              onChange={(e) => setNewCooldown(e.target.value)}
              className="text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <div className="col-span-2">
              <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-1">
                <Bell className="w-3 h-3 text-amber-400" /> Template de popup
                (opcional)
              </label>
              <select
                value={newTemplateId}
                onChange={(e) => setNewTemplateId(e.target.value)}
                className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">— Sem popup —</option>
                {popupTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="text-xs text-zinc-400 hover:text-white px-3 py-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              {creating ? "..." : "Criar"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-all text-xs"
        >
          <Plus className="w-3.5 h-3.5" /> Nova regra para esta empresa
        </button>
      )}
    </div>
  );
}
