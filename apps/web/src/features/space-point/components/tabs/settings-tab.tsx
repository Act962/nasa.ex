"use client";

import { useState } from "react";
import { Plus, Trash2, Trophy, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSpacePointRules, useUpdateSpacePointRule, useCreateSpacePointRule,
  useDeleteSpacePointRule, useSpacePointPrizes, useUpsertSpacePointPrize,
  useDeleteSpacePointPrize,
} from "../../hooks/use-space-point";
import { useOrgRole } from "@/hooks/use-org-role";
import { toast } from "sonner";

const CATEGORY_COLOR: Record<string, string> = {
  leads:     "bg-orange-500/15 text-orange-300 border-orange-500/30",
  agenda:    "bg-blue-500/15 text-blue-300 border-blue-500/30",
  workspace: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  form:      "bg-green-500/15 text-green-300 border-green-500/30",
  system:    "bg-purple-500/15 text-purple-300 border-purple-500/30",
  tools:     "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  custom:    "bg-pink-500/15 text-pink-300 border-pink-500/30",
};

const CATEGORY_LABEL: Record<string, string> = {
  leads: "Leads", agenda: "Agenda", workspace: "Workspace",
  form: "Formulários", system: "Engajamento", tools: "Ferramentas", custom: "Personalizada",
};

const PRIZE_MEDALS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
const PRIZE_PERIODS = [
  { key: "weekly",   label: "Semanal"   },
  { key: "biweekly", label: "Quinzenal" },
  { key: "monthly",  label: "Mensal"    },
  { key: "annual",   label: "Anual"     },
];

interface Rule {
  id: string; action: string; label: string;
  points: number; cooldownHours: number | null; isActive: boolean; category: string;
}

function RuleRow({ rule, canManage, onSave, onDelete }: {
  rule: Rule; canManage: boolean;
  onSave: (id: string, patch: Partial<Rule>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing]   = useState(false);
  const [points, setPoints]     = useState(rule.points);
  const [label, setLabel]       = useState(rule.label);
  const [cooldown, setCooldown] = useState(rule.cooldownHours?.toString() ?? "");
  const [loading, setLoading]   = useState(false);
  const isCustom = rule.category === "custom";

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(rule.id, { label, points, cooldownHours: cooldown === "" ? null : parseFloat(cooldown) });
      setEditing(false);
      toast.success("Regra atualizada!");
    } catch { toast.error("Erro ao salvar"); }
    finally { setLoading(false); }
  };

  const handleToggle = async () => {
    if (!canManage) return;
    setLoading(true);
    try { await onSave(rule.id, { isActive: !rule.isActive }); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!canManage || !isCustom) return;
    if (!confirm("Excluir esta regra personalizada?")) return;
    setLoading(true);
    try { await onDelete(rule.id); toast.success("Regra excluída!"); }
    catch { toast.error("Erro ao excluir"); }
    finally { setLoading(false); }
  };

  return (
    <div className={cn("rounded-xl border p-3 space-y-2 transition-all",
      rule.isActive ? "border-[#7a1fe7]/25 bg-[#7a1fe7]/5" : "border-border/40 bg-muted/10 opacity-50")}>
      <div className="flex items-start gap-2">
        <button onClick={handleToggle} disabled={loading || !canManage}
          className={cn("mt-0.5 w-8 h-5 rounded-full transition-all shrink-0", rule.isActive ? "bg-[#7a1fe7]" : "bg-muted", !canManage && "cursor-default")}>
          <div className={cn("w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5", rule.isActive ? "translate-x-3" : "translate-x-0")} />
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <input className="w-full text-sm bg-background border border-[#7a1fe7]/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7a1fe7]"
              value={label} onChange={(e) => setLabel(e.target.value)} />
          ) : (
            <p className="text-sm font-medium truncate">{rule.label}</p>
          )}
          <div className="flex items-center gap-1 mt-0.5">
            <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full border", CATEGORY_COLOR[rule.category] ?? CATEGORY_COLOR.custom)}>
              {CATEGORY_LABEL[rule.category] ?? rule.category}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">{rule.action}</span>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1">
          {editing ? (
            <input type="number" min={0} className="w-16 text-sm bg-background border border-[#7a1fe7]/30 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-1 focus:ring-[#7a1fe7]"
              value={points} onChange={(e) => setPoints(parseInt(e.target.value, 10) || 0)} />
          ) : (
            <span className="text-sm font-bold text-[#a78bfa]">{rule.points}</span>
          )}
          <span className="text-[10px] text-muted-foreground">pts</span>
        </div>

        {isCustom && canManage && !editing && (
          <button onClick={handleDelete} disabled={loading} className="shrink-0 text-red-400/60 hover:text-red-400 transition-all p-1">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {editing && (
        <div className="flex items-center gap-2 pl-10">
          <span className="text-[11px] text-muted-foreground">Cooldown (h):</span>
          <input type="number" min={0} step={0.5} placeholder="sem limite"
            className="w-24 text-xs bg-background border border-[#7a1fe7]/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7a1fe7]"
            value={cooldown} onChange={(e) => setCooldown(e.target.value)} />
        </div>
      )}

      {!editing && rule.cooldownHours && (
        <p className="text-[10px] text-muted-foreground pl-10">⏱ Cooldown: {rule.cooldownHours}h</p>
      )}

      {canManage && (
        <div className="flex justify-end gap-2 pl-10">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded">Cancelar</button>
              <button onClick={handleSave} disabled={loading} className="text-[11px] bg-[#7a1fe7] text-white px-3 py-1 rounded-lg hover:bg-[#6d28d9] disabled:opacity-50">
                {loading ? "..." : "Salvar"}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="text-[11px] text-[#a78bfa] hover:text-[#7a1fe7] px-2 py-1 rounded">Editar</button>
          )}
        </div>
      )}
    </div>
  );
}

function CreateRuleForm({ onDone }: { onDone: () => void }) {
  const [action, setAction]     = useState("");
  const [label, setLabel]       = useState("");
  const [points, setPoints]     = useState(5);
  const [cooldown, setCooldown] = useState("");
  const { mutateAsync, isPending } = useCreateSpacePointRule();

  const handleSubmit = async () => {
    if (!action.trim() || !label.trim() || points < 1) return toast.error("Preencha todos os campos.");
    const result = await mutateAsync({ action: action.toLowerCase().replace(/\s+/g, "_"), label, points, cooldownHours: cooldown ? parseFloat(cooldown) : null });
    if (result.success) { toast.success("Regra criada!"); onDone(); }
    else toast.error("Erro ao criar regra.");
  };

  return (
    <div className="rounded-xl border border-[#7a1fe7]/30 bg-[#7a1fe7]/5 p-3 space-y-2">
      <p className="text-xs font-semibold text-[#a78bfa]">Nova regra personalizada</p>
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Identificador (ex: minha_acao)" value={action} onChange={(e) => setAction(e.target.value)}
          className="col-span-2 text-xs bg-background border border-[#7a1fe7]/30 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#7a1fe7]" />
        <input placeholder="Descrição (ex: Criar proposta)" value={label} onChange={(e) => setLabel(e.target.value)}
          className="col-span-2 text-xs bg-background border border-[#7a1fe7]/30 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#7a1fe7]" />
        <div className="flex items-center gap-1.5">
          <input type="number" min={1} placeholder="Pontos" value={points} onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
            className="w-full text-xs bg-background border border-[#7a1fe7]/30 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#7a1fe7]" />
          <span className="text-[10px] text-muted-foreground shrink-0">pts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <input type="number" min={0} step={0.5} placeholder="Cooldown (h)" value={cooldown} onChange={(e) => setCooldown(e.target.value)}
            className="w-full text-xs bg-background border border-[#7a1fe7]/30 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#7a1fe7]" />
          <span className="text-[10px] text-muted-foreground shrink-0">h</span>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onDone} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1 rounded">Cancelar</button>
        <button onClick={handleSubmit} disabled={isPending}
          className="text-xs bg-[#7a1fe7] text-white px-3 py-1.5 rounded-lg hover:bg-[#6d28d9] disabled:opacity-50 flex items-center gap-1.5">
          <Plus className="size-3" /> {isPending ? "Criando..." : "Criar regra"}
        </button>
      </div>
    </div>
  );
}

function PrizeCard({ rank, prize, period, canManage }: {
  rank: number;
  prize?: { id: string; title: string; description: string | null; isActive: boolean };
  period: string;
  canManage: boolean;
}) {
  const [editing, setEditing]   = useState(false);
  const [title, setTitle]       = useState(prize?.title ?? "");
  const [description, setDesc]  = useState(prize?.description ?? "");
  const { mutateAsync: upsert, isPending: saving }   = useUpsertSpacePointPrize();
  const { mutateAsync: del,    isPending: deleting }  = useDeleteSpacePointPrize();

  const medal = PRIZE_MEDALS[rank - 1] ?? `#${rank}`;
  const accentMap: Record<number, string> = {
    1: "border-yellow-500/40 bg-yellow-500/8",
    2: "border-zinc-400/40 bg-zinc-400/8",
    3: "border-orange-400/40 bg-orange-400/8",
  };
  const accent = accentMap[rank] ?? "border-[#7a1fe7]/25 bg-[#7a1fe7]/5";

  const handleSave = async () => {
    if (!title.trim()) return;
    await upsert({ rank, period, title, description: description || undefined });
    setEditing(false);
    toast.success("Premiação salva!");
  };

  const handleDelete = async () => {
    if (!prize?.id || !confirm("Remover esta premiação?")) return;
    await del({ id: prize.id, period });
    toast.success("Premiação removida.");
  };

  return (
    <div className={cn("rounded-xl border p-3 space-y-1.5 transition-all", accent)}>
      <div className="flex items-center gap-2">
        <span className="text-lg shrink-0">{medal}</span>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Prêmio para ${rank}º lugar`}
              className="w-full text-sm bg-background border border-[#7a1fe7]/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7a1fe7]" />
          ) : prize ? (
            <p className="text-sm font-semibold truncate">{prize.title}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sem prêmio definido</p>
          )}
        </div>
        {canManage && !editing && (
          <div className="flex gap-1">
            <button onClick={() => { setTitle(prize?.title ?? ""); setDesc(prize?.description ?? ""); setEditing(true); }}
              className="text-[10px] text-[#a78bfa] hover:text-white px-2 py-1 rounded bg-[#7a1fe7]/15 hover:bg-[#7a1fe7]/30 transition-all">
              {prize ? "Editar" : "+ Adicionar"}
            </button>
            {prize && (
              <button onClick={handleDelete} disabled={deleting} className="text-red-400/60 hover:text-red-400 p-1 transition-all">
                <Trash2 className="size-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <>
          <textarea value={description} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição do prêmio (opcional)" rows={2}
            className="w-full text-xs bg-background border border-[#7a1fe7]/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7a1fe7] resize-none" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground px-2 py-1 rounded">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="text-xs bg-[#7a1fe7] text-white px-3 py-1.5 rounded-lg hover:bg-[#6d28d9] disabled:opacity-50">
              {saving ? "..." : "Salvar"}
            </button>
          </div>
        </>
      )}

      {!editing && prize?.description && (
        <p className="text-[10px] text-muted-foreground pl-8">{prize.description}</p>
      )}
    </div>
  );
}

export function SettingsTab() {
  const { data: rules, isLoading } = useSpacePointRules();
  const { mutateAsync: updateRule } = useUpdateSpacePointRule();
  const { mutateAsync: deleteRule } = useDeleteSpacePointRule();
  const { canManage } = useOrgRole();

  const [showCreateRule, setShowCreateRule] = useState(false);
  const [prizePeriod, setPrizePeriod]       = useState("monthly");
  const [openSection, setOpenSection]       = useState<"rules" | "prizes">("prizes");
  const { data: prizes } = useSpacePointPrizes(prizePeriod);

  const grouped = (rules ?? []).reduce<Record<string, Rule[]>>((acc, r) => {
    const cat = r.category ?? "custom";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 pb-4">

      {/* ── Prizes section ── */}
      <div className="rounded-xl border border-[#7a1fe7]/20 overflow-hidden">
        <button onClick={() => setOpenSection(openSection === "prizes" ? "rules" : "prizes")}
          className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-yellow-500/10 to-[#7a1fe7]/10 hover:bg-[#7a1fe7]/10 transition-all">
          <Trophy className="size-4 text-yellow-400 shrink-0" />
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">🏆 Premiações por Colocação</p>
            <p className="text-[10px] text-muted-foreground">Configure prêmios para os melhores colocados do ranking</p>
          </div>
          {openSection === "prizes" ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </button>

        {openSection === "prizes" && (
          <div className="p-3 space-y-3 border-t border-[#7a1fe7]/15">
            <div className="flex gap-1 bg-white/5 rounded-xl p-1">
              {PRIZE_PERIODS.map((p) => (
                <button key={p.key} onClick={() => setPrizePeriod(p.key)}
                  className={cn("flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
                    prizePeriod === p.key ? "bg-[#7a1fe7] text-white" : "text-muted-foreground hover:text-foreground")}>
                  {p.label}
                </button>
              ))}
            </div>

            {!canManage && (
              <p className="text-[11px] text-muted-foreground bg-muted/20 rounded-lg px-3 py-2">
                🔒 Apenas master e moderadores podem configurar premiações.
              </p>
            )}

            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((rank) => {
                const prize = prizes?.find((p) => p.rank === rank);
                return <PrizeCard key={rank} rank={rank} prize={prize} period={prizePeriod} canManage={canManage} />;
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Rules section ── */}
      <div className="rounded-xl border border-[#7a1fe7]/20 overflow-hidden">
        <button onClick={() => setOpenSection(openSection === "rules" ? "prizes" : "rules")}
          className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#7a1fe7]/10 to-transparent hover:bg-[#7a1fe7]/10 transition-all">
          <Settings2 className="size-4 text-[#a78bfa] shrink-0" />
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">⚙️ Regras de Pontuação</p>
            <p className="text-[10px] text-muted-foreground">{(rules ?? []).length} regras • ative/desative e ajuste valores</p>
          </div>
          {openSection === "rules" ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </button>

        {openSection === "rules" && (
          <div className="p-3 border-t border-[#7a1fe7]/15 space-y-3">
            {!canManage && (
              <p className="text-[11px] text-muted-foreground bg-muted/20 rounded-lg px-3 py-2">
                🔒 Apenas master e moderadores podem editar regras.
              </p>
            )}

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([cat, catRules]) => (
                  <div key={cat}>
                    <span className={cn("text-[9px] font-bold uppercase tracking-wider mb-2 inline-block px-2 py-0.5 rounded-full border", CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.custom)}>
                      {CATEGORY_LABEL[cat] ?? cat}
                    </span>
                    <div className="space-y-1.5">
                      {catRules.map((rule) => (
                        <RuleRow key={rule.id} rule={rule} canManage={canManage}
                          onSave={async (id, patch) => { await updateRule({ id, ...patch }); }}
                          onDelete={async (id) => { await deleteRule({ id }); }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canManage && (
              <div>
                {showCreateRule ? (
                  <CreateRuleForm onDone={() => setShowCreateRule(false)} />
                ) : (
                  <button onClick={() => setShowCreateRule(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#7a1fe7]/30 text-[#a78bfa] hover:bg-[#7a1fe7]/10 transition-all text-xs">
                    <Plus className="size-3.5" /> Nova regra personalizada
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
