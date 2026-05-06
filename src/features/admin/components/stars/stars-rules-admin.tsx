"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { Search, Plus, ChevronRight, Settings, Bell, Star } from "lucide-react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────
interface OrgOption { id: string; name: string; slug: string; logo?: string | null }

// ── Hooks ──────────────────────────────────────────────────────────────────────
function useStarRules(orgId: string | null) {
  return useQuery({
    ...orpc.admin.adminGetStarRules.queryOptions({ input: { orgId: orgId ?? "" } }),
    queryKey: ["admin", "starRules", orgId],
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

function useCreateStarRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { orgId: string; action: string; label: string; stars: number; cooldownHours?: number | null; popupTemplateId?: string | null }) =>
      orpc.admin.adminCreateStarRule.call(vars),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "starRules", vars.orgId] });
      toast.success("Regra criada!");
    },
    onError: () => toast.error("Erro ao criar regra"),
  });
}

function useUpdateStarRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; orgId: string; stars?: number; isActive?: boolean; label?: string; cooldownHours?: number | null; popupTemplateId?: string | null }) =>
      orpc.admin.adminUpdateStarRule.call({ id: vars.id, stars: vars.stars, isActive: vars.isActive, label: vars.label, cooldownHours: vars.cooldownHours, popupTemplateId: vars.popupTemplateId }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "starRules", vars.orgId] });
    },
  });
}

function usePopupTemplates() {
  return useQuery({
    queryKey: ["admin", "popupTemplates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/popup-templates");
      const data = await res.json();
      return (data as { id: string; name: string }[]) ?? [];
    },
    staleTime: 60_000,
  });
}

// ── Rules Tab ─────────────────────────────────────────────────────────────────
function StarRulesTab({ orgId }: { orgId: string }) {
  const { data: rules, isLoading } = useStarRules(orgId);
  const { data: popupTemplates = [] } = usePopupTemplates();
  const { mutateAsync: updateRule } = useUpdateStarRule();
  const { mutateAsync: createRule, isPending: creating } = useCreateStarRule();
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [newAction, setNewAction]       = useState("");
  const [newLabel, setNewLabel]         = useState("");
  const [newStars, setNewStars]         = useState(1);
  const [newCooldown, setNewCooldown]   = useState("");
  const [newTemplateId, setNewTemplateId] = useState<string>("");

  const handleCreate = async () => {
    if (!newAction.trim() || !newLabel.trim()) return toast.error("Preencha os campos obrigatórios");
    await createRule({
      orgId,
      action: newAction.toLowerCase().replace(/\s+/g, "_"),
      label: newLabel,
      stars: newStars,
      cooldownHours: newCooldown ? parseFloat(newCooldown) : null,
      popupTemplateId: newTemplateId || null,
    });
    setShowCreate(false); setNewAction(""); setNewLabel(""); setNewStars(1); setNewCooldown(""); setNewTemplateId("");
  };

  // Group by category
  const grouped: Record<string, typeof rules> = {};
  for (const rule of rules ?? []) {
    const cat = (rule as { category?: string }).category ?? "custom";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat]!.push(rule);
  }

  const CATEGORY_LABEL: Record<string, string> = {
    leads: "CRM / Leads", ai: "IA & NASA Command", forge: "Forge",
    planner: "NASA Planner", automation: "Workflows & Automações",
    agenda: "Agenda", chat: "Chat & Mensagens", forms: "Formulários",
    nbox: "N.Box", workspace: "Workspace", integration: "Integrações",
    insights: "Analytics & Insights", system: "Sistema / Alertas", custom: "Personalizada",
  };

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-zinc-800 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, catRules]) => (
            <div key={cat}>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5 px-1">
                {CATEGORY_LABEL[cat] ?? cat}
              </p>
              <div className="space-y-1.5">
                {(catRules ?? []).map((rule) => {
                  const isExpanded = expandedRule === rule.id;
                  return (
                    <div key={rule.id} className={cn("rounded-lg border transition-all",
                      rule.isActive ? "bg-zinc-800/50 border-zinc-700" : "bg-zinc-900 border-zinc-800 opacity-50")}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        {/* Active toggle */}
                        <button
                          onClick={() => updateRule({ id: rule.id, orgId, isActive: !rule.isActive })}
                          className={cn("w-8 h-5 rounded-full transition-all shrink-0", rule.isActive ? "bg-yellow-500" : "bg-zinc-700")}>
                          <div className={cn("w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-transform", rule.isActive ? "translate-x-3" : "")} />
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{rule.label}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[10px] text-zinc-500 font-mono">{rule.action}{rule.cooldownHours ? ` · ⏱ ${rule.cooldownHours}h` : ""}</p>
                            {rule.popupTemplateId && (
                              <span className="flex items-center gap-0.5 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                                <Bell className="w-2.5 h-2.5" /> {rule.popupTemplateName ?? "Template"}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-sm font-bold text-yellow-400 shrink-0 flex items-center gap-1">
                          <Star className="w-3 h-3" />{rule.stars}
                        </span>

                        <button
                          onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                          title="Configurar template de popup"
                          className={cn("shrink-0 h-6 w-6 flex items-center justify-center rounded transition-all",
                            rule.popupTemplateId ? "text-amber-400 bg-amber-500/10 hover:bg-amber-500/20" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                          )}
                        >
                          <Bell className="w-3 h-3" />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0 border-t border-zinc-700/50">
                          <p className="text-[11px] text-zinc-400 mt-2 mb-1.5 font-medium flex items-center gap-1.5">
                            <Bell className="w-3 h-3 text-amber-400" />
                            Template de popup ao ganhar stars nesta regra
                          </p>
                          <div className="flex items-center gap-2">
                            <select
                              value={rule.popupTemplateId ?? ""}
                              onChange={(e) => updateRule({ id: rule.id, orgId, popupTemplateId: e.target.value || null })}
                              className="flex-1 text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                              <option value="">— Sem popup —</option>
                              {popupTemplates.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                            {rule.popupTemplateId && (
                              <button
                                onClick={() => updateRule({ id: rule.id, orgId, popupTemplateId: null })}
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
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate ? (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-yellow-400">Nova regra de Stars</p>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Identificador (ex: minha_acao)" value={newAction} onChange={(e) => setNewAction(e.target.value)}
              className="col-span-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-yellow-500" />
            <input placeholder="Descrição" value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              className="col-span-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-yellow-500" />
            <input type="number" min={0} placeholder="Stars" value={newStars} onChange={(e) => setNewStars(parseInt(e.target.value) || 0)}
              className="text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-yellow-500" />
            <input type="number" min={0} step={0.5} placeholder="Cooldown (h)" value={newCooldown} onChange={(e) => setNewCooldown(e.target.value)}
              className="text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-yellow-500" />
            <div className="col-span-2">
              <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-1">
                <Bell className="w-3 h-3 text-amber-400" /> Template de popup (opcional)
              </label>
              <select
                value={newTemplateId}
                onChange={(e) => setNewTemplateId(e.target.value)}
                className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">— Sem popup —</option>
                {popupTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="text-xs text-zinc-400 hover:text-white px-3 py-1">Cancelar</button>
            <button onClick={handleCreate} disabled={creating} className="text-xs bg-yellow-600 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-700 disabled:opacity-50">
              {creating ? "..." : "Criar"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-all text-xs">
          <Plus className="w-3.5 h-3.5" /> Nova regra para esta empresa
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
interface Props { allOrgs: OrgOption[] }

export function StarsRulesAdmin({ allOrgs }: Props) {
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [search, setSearch]           = useState("");

  const filteredOrgs = allOrgs.filter((o) =>
    !search || o.name.toLowerCase().includes(search.toLowerCase())
  );
  const selectedOrgName = allOrgs.find((o) => o.id === selectedOrg)?.name ?? "";

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[260px_1fr]">
      {/* Left: org selector */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Empresas</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empresa..."
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-yellow-500" />
        </div>
        <div className="max-h-60 lg:max-h-[calc(100vh-300px)] overflow-y-auto space-y-0.5">
          {filteredOrgs.map((org) => (
            <button key={org.id} onClick={() => setSelectedOrg(org.id)}
              className={cn("w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all",
                selectedOrg === org.id ? "bg-yellow-500/10 text-yellow-300 border border-yellow-500/20" : "text-zinc-400 hover:bg-zinc-800 hover:text-white border border-transparent")}>
              {org.logo ? (
                <div className="relative w-5 h-5 rounded-full overflow-hidden shrink-0">
                  <Image src={org.logo} alt={org.name} fill className="object-cover" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-[9px] text-white font-bold shrink-0">
                  {org.name[0]}
                </div>
              )}
              <span className="text-xs truncate">{org.name}</span>
              <ChevronRight className="w-3 h-3 ml-auto shrink-0 opacity-40" />
            </button>
          ))}
        </div>
      </div>

      {/* Right: rules panel */}
      <div>
        {selectedOrg ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-800/50">
              <Settings className="w-4 h-4 text-yellow-400" />
              <p className="text-sm font-semibold text-white">Regras de Stars — {selectedOrgName}</p>
            </div>
            <div className="p-4">
              <StarRulesTab orgId={selectedOrg} />
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-20 bg-zinc-900 border border-zinc-800 rounded-xl">
            <Star className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-sm font-semibold text-zinc-400">Selecione uma empresa</p>
            <p className="text-xs text-zinc-600 mt-1">para gerenciar as regras de Stars</p>
          </div>
        )}
      </div>
    </div>
  );
}
