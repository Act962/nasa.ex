"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Search,
  Plus,
  Trash2,
  ChevronRight,
  ArrowUpCircle,
  ArrowDownCircle,
  Users,
  Settings,
  BarChart2,
  Zap,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { OrgRulesTab } from "./org-rules-tab";

// ── Types ──────────────────────────────────────────────────────────────────────
interface TopOrg {
  orgId: string;
  orgName: string;
  orgLogo: string | null;
  totalPoints: number;
  userCount: number;
}

interface OrgOption {
  id: string;
  name: string;
  slug: string;
}

// ── Hooks ──────────────────────────────────────────────────────────────────────
function useAdminOrgUsers(orgId: string | null, page: number) {
  return useQuery({
    ...orpc.spacePoint.adminOrgUsers.queryOptions({
      input: { orgId: orgId ?? "", page, limit: 20 },
    }),
    queryKey: ["admin", "spacePoints", "orgUsers", orgId, page],
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

function useAdminAdjust() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      userId: string;
      orgId: string;
      points: number;
      description: string;
    }) => orpc.spacePoint.adminAdjust.call(vars),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ["admin", "spacePoints", "orgUsers", vars.orgId],
      });
      toast.success("Pontos ajustados!");
    },
    onError: () => toast.error("Erro ao ajustar pontos"),
  });
}

function useAdminCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      orgId: string;
      action: string;
      label: string;
      points: number;
      cooldownHours?: number | null;
    }) => orpc.spacePoint.adminCreateRule.call(vars),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ["admin", "spacePoints", "orgRules", vars.orgId],
      });
      toast.success("Regra criada!");
    },
    onError: () => toast.error("Erro ao criar regra"),
  });
}

function useAdminUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      orgId: string;
      points?: number;
      isActive?: boolean;
      label?: string;
      cooldownHours?: number | null;
    }) =>
      orpc.spacePoint.adminUpdateRule.call({
        id: vars.id,
        points: vars.points,
        isActive: vars.isActive,
        label: vars.label,
        cooldownHours: vars.cooldownHours,
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ["admin", "spacePoints", "orgRules", vars.orgId],
      });
    },
  });
}

// ── Adjust modal ───────────────────────────────────────────────────────────────
function AdjustModal({
  userId,
  orgId,
  userName,
  totalPoints,
  onClose,
}: {
  userId: string;
  orgId: string;
  userName: string;
  totalPoints: number;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const { mutateAsync, isPending } = useAdminAdjust();

  const handleSubmit = async () => {
    const numAmount = parseInt(amount) || 0;
    if (numAmount === 0) return toast.error("Insira um valor diferente de 0");
    await mutateAsync({
      userId,
      orgId,
      points: numAmount,
      description:
        reason ||
        (numAmount > 0
          ? "Pontos adicionados pelo admin"
          : "Pontos removidos pelo admin"),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-card border border-line rounded-2xl p-6 w-80 space-y-4">
        <h3 className="text-sm font-bold text-foreground">
          Ajustar pontos — {userName}
        </h3>
        <p className="text-xs text-muted-foreground">
          Total atual:{" "}
          <span className="text-info font-bold">
            {totalPoints.toLocaleString("pt-BR")} pts
          </span>
        </p>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">
            Valor (positivo = adicionar, negativo = remover)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full text-sm bg-muted border border-line rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Motivo (opcional)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Premiação do mês"
            className="w-full text-sm bg-muted border border-line rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 text-sm py-2 rounded-lg bg-muted text-foreground hover:bg-knob"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              isPending || amount.trim() === "" || parseInt(amount) === 0
            }
            className="flex-1 text-sm py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Org users list ─────────────────────────────────────────────────────────────
function OrgUsersTab({ orgId }: { orgId: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [adjusting, setAdjusting] = useState<{
    userId: string;
    name: string;
    total: number;
  } | null>(null);
  const { data, isLoading } = useAdminOrgUsers(orgId, page);

  const filtered = (data?.users ?? []).filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      {adjusting && (
        <AdjustModal
          userId={adjusting.userId}
          orgId={orgId}
          userName={adjusting.name}
          totalPoints={adjusting.total}
          onClose={() => setAdjusting(null)}
        />
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar usuário..."
          className="w-full pl-8 pr-3 py-2 text-sm bg-muted border border-line rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum usuário encontrado.
        </p>
      ) : (
        <div className="space-y-1">
          {filtered.map((u, idx) => (
            <div
              key={u.userId}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-all"
            >
              <span className="text-xs text-muted-foreground w-5 shrink-0">
                {(page - 1) * 20 + idx + 1}
              </span>
              <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 border border-line">
                {u.image ? (
                  <Image
                    src={u.image}
                    alt={u.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-info/15 flex items-center justify-center text-xs text-info font-bold">
                    {u.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {u.name}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {u.email} {u.levelName ? `· ${u.levelName}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-info">
                  {u.totalPoints.toLocaleString("pt-BR")} pts
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {u.weeklyPoints} esta semana
                </p>
              </div>
              <button
                onClick={() =>
                  setAdjusting({
                    userId: u.userId,
                    name: u.name,
                    total: u.totalPoints,
                  })
                }
                title="Ajustar pontos"
                className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg bg-knob hover:bg-info/15 transition-all text-muted-foreground hover:text-info"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {data && data.total > 20 && (
        <div className="flex items-center justify-between pt-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-xs px-3 py-1.5 rounded-lg bg-muted text-foreground hover:bg-knob disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-xs text-muted-foreground">
            Página {page} · {data.total} total
          </span>
          <button
            disabled={page * 20 >= data.total}
            onClick={() => setPage((p) => p + 1)}
            className="text-xs px-3 py-1.5 rounded-lg bg-muted text-foreground hover:bg-knob disabled:opacity-40"
          >
            Próximo →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Org rules tab ──────────────────────────────────────────────────────────────
// function OrgRulesTab({ orgId }: { orgId: string }) {
//   const { data: rules, isLoading } = useAdminOrgRules(orgId);
//   const { mutateAsync: updateRule } = useAdminUpdateRule();
//   const { mutateAsync: createRule, isPending: creating } = useAdminCreateRule();
//   const [showCreate, setShowCreate] = useState(false);
//   const [newAction, setNewAction] = useState("");
//   const [newLabel, setNewLabel] = useState("");
//   const [newPoints, setNewPoints] = useState(5);
//   const [newCooldown, setNewCooldown] = useState("");

//   const handleCreate = async () => {
//     if (!newAction.trim() || !newLabel.trim())
//       return toast.error("Preencha os campos obrigatórios");
//     await createRule({
//       orgId,
//       action: newAction.toLowerCase().replace(/\s+/g, "_"),
//       label: newLabel,
//       points: newPoints,
//       cooldownHours: newCooldown ? parseFloat(newCooldown) : null,
//     });
//     setShowCreate(false);
//     setNewAction("");
//     setNewLabel("");
//     setNewPoints(5);
//     setNewCooldown("");
//   };

//   return (
//     <div className="space-y-3">
//       {isLoading ? (
//         <div className="space-y-2">
//           {Array.from({ length: 4 }).map((_, i) => (
//             <div
//               key={i}
//               className="h-12 rounded-lg bg-muted animate-pulse"
//             />
//           ))}
//         </div>
//       ) : (
//         <div className="space-y-1.5">
//           {(rules ?? []).map((rule) => (
//             <div
//               key={rule.id}
//               className={cn(
//                 "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
//                 rule.isActive
//                   ? "bg-muted/50 border-line"
//                   : "bg-card border-border opacity-50",
//               )}
//             >
//               <button
//                 onClick={() =>
//                   updateRule({ id: rule.id, orgId, isActive: !rule.isActive })
//                 }
//                 className={cn(
//                   "w-8 h-5 rounded-full transition-all shrink-0",
//                   rule.isActive ? "bg-primary" : "bg-knob",
//                 )}
//               >
//                 <div
//                   className={cn(
//                     "w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-transform",
//                     rule.isActive ? "translate-x-3" : "",
//                   )}
//                 />
//               </button>
//               <div className="flex-1 min-w-0">
//                 <p className="text-sm text-foreground truncate">{rule.label}</p>
//                 <p className="text-[10px] text-muted-foreground font-mono">
//                   {rule.action}{" "}
//                   {rule.cooldownHours ? `· ⏱ ${rule.cooldownHours}h` : ""}
//                 </p>
//               </div>
//               <span className="text-sm font-bold text-info shrink-0">
//                 {rule.points} pts
//               </span>
//             </div>
//           ))}
//         </div>
//       )}

//       {showCreate ? (
//         <div className="rounded-xl border border-info/30 bg-info/5 p-3 space-y-2">
//           <p className="text-xs font-semibold text-info">Nova regra</p>
//           <div className="grid grid-cols-2 gap-2">
//             <input
//               placeholder="Identificador"
//               value={newAction}
//               onChange={(e) => setNewAction(e.target.value)}
//               className="col-span-2 text-xs bg-muted border border-line rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
//             />
//             <input
//               placeholder="Descrição"
//               value={newLabel}
//               onChange={(e) => setNewLabel(e.target.value)}
//               className="col-span-2 text-xs bg-muted border border-line rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
//             />
//             <input
//               type="number"
//               min={1}
//               placeholder="Pontos"
//               value={newPoints}
//               onChange={(e) => setNewPoints(parseInt(e.target.value) || 1)}
//               className="text-xs bg-muted border border-line rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
//             />
//             <input
//               type="number"
//               min={0}
//               step={0.5}
//               placeholder="Cooldown (h)"
//               value={newCooldown}
//               onChange={(e) => setNewCooldown(e.target.value)}
//               className="text-xs bg-muted border border-line rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
//             />
//           </div>
//           <div className="flex gap-2 justify-end">
//             <button
//               onClick={() => setShowCreate(false)}
//               className="text-xs text-muted-foreground hover:text-foreground px-3 py-1"
//             >
//               Cancelar
//             </button>
//             <button
//               onClick={handleCreate}
//               disabled={creating}
//               className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50"
//             >
//               {creating ? "..." : "Criar"}
//             </button>
//           </div>
//         </div>
//       ) : (
//         <button
//           onClick={() => setShowCreate(true)}
//           className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-info/30 text-info hover:bg-info/10 transition-all text-xs"
//         >
//           <Plus className="w-3.5 h-3.5" /> Nova regra para esta empresa
//         </button>
//       )}
//     </div>
//   );
// }

// ── Org panel ──────────────────────────────────────────────────────────────────
function OrgPanel({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [tab, setTab] = useState<"users" | "rules">("users");

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
        <p className="text-sm font-semibold text-foreground">{orgName}</p>
        <div className="flex gap-1 bg-panel rounded-full p-1">
          {(
            [
              { key: "users", icon: Users, label: "Usuários" },
              { key: "rules", icon: Settings, label: "Regras" },
            ] as const
          ).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                tab === key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        {tab === "users" ? (
          <OrgUsersTab orgId={orgId} />
        ) : (
          <OrgRulesTab orgId={orgId} />
        )}
      </div>
    </div>
  );
}

interface Props {
  topOrgs: TopOrg[];
  allOrgs: OrgOption[];
}

export function SpacePointsAdminClient({ topOrgs, allOrgs }: Props) {
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredOrgs = allOrgs.filter(
    (o) => !search || o.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedOrgName = allOrgs.find((o) => o.id === selectedOrg)?.name ?? "";

  return (
    <div className="grid grid-cols-[280px_1fr] gap-6">
      {/* Left: top orgs + selector */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Top Empresas
          </h2>
          <div className="space-y-1.5">
            {topOrgs.slice(0, 10).map((org, idx) => (
              <button
                key={org.orgId}
                onClick={() => setSelectedOrg(org.orgId)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all",
                  selectedOrg === org.orgId
                    ? "bg-info/15 border border-info/30"
                    : "bg-card border border-border hover:bg-muted",
                )}
              >
                <span className="text-xs text-muted-foreground w-4 shrink-0">
                  #{idx + 1}
                </span>
                {org.orgLogo ? (
                  <div className="relative w-6 h-6 rounded-full overflow-hidden shrink-0">
                    <Image
                      src={org.orgLogo}
                      alt={org.orgName}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-info/15 flex items-center justify-center text-[9px] text-info font-bold shrink-0">
                    {org.orgName[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {org.orgName}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {org.userCount} usuários
                  </p>
                </div>
                <span className="text-[10px] font-bold text-info shrink-0">
                  {org.totalPoints.toLocaleString("pt-BR")}
                </span>
                <ChevronRight className="w-3 h-3 text-muted-foreground/70 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Todas as empresas
          </h2>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empresa..."
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-muted border border-line rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filteredOrgs.map((org) => (
              <button
                key={org.id}
                onClick={() => setSelectedOrg(org.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all",
                  selectedOrg === org.id
                    ? "bg-info/15 text-info"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="text-xs truncate">{org.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: org panel */}
      <div>
        {selectedOrg ? (
          <OrgPanel orgId={selectedOrg} orgName={selectedOrgName} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-20 bg-card border border-border rounded-xl">
            <BarChart2 className="w-10 h-10 text-muted-foreground/70 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">
              Selecione uma empresa
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              para ver usuários, pontos e gerenciar regras
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
