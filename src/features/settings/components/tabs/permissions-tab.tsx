"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Shield, Users, Clock, Star, Trash2, ChevronDown, ChevronUp,
  Eye, PenLine, Plus, UserX, Lock, CheckCircle2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Role config ─────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; bg: string; border: string; description: string }> = {
  owner:     { label: "Master",    color: "text-violet-700 dark:text-violet-300", bg: "bg-violet-100 dark:bg-violet-900/40", border: "border-violet-300 dark:border-violet-700", description: "Acesso total. Criador da conta." },
  admin:     { label: "Adm",      color: "text-blue-700 dark:text-blue-300",   bg: "bg-blue-100 dark:bg-blue-900/40",   border: "border-blue-300 dark:border-blue-700",   description: "Permissões intermediárias." },
  member:    { label: "Single",   color: "text-slate-700 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-900/40", border: "border-slate-300 dark:border-slate-700", description: "Acesso limitado ao que o Master autorizar." },
  moderador: { label: "Moderador", color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-100 dark:bg-orange-900/40", border: "border-orange-300 dark:border-orange-700", description: "Modera usuários e acessa múltiplas contas." },
};

const PERM_KEYS = ["canView", "canCreate", "canEdit", "canDelete"] as const;
const PERM_LABELS: Record<string, { label: string; icon: React.FC<{ className?: string }> }> = {
  canView:   { label: "Ver",    icon: Eye },
  canCreate: { label: "Criar",  icon: Plus },
  canEdit:   { label: "Editar", icon: PenLine },
  canDelete: { label: "Excluir", icon: Trash2 },
};

function RoleBadge({ role, size = "sm" }: { role: string; size?: "xs" | "sm" }) {
  const meta = ROLE_META[role];
  if (!meta) return <Badge variant="outline">{role}</Badge>;
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border font-semibold",
      meta.color, meta.bg, meta.border,
      size === "xs" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs",
    )}>
      {meta.label}
    </span>
  );
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

// ─── Permission Matrix ────────────────────────────────────────────────────────

function PermissionMatrix({
  apps, matrix, isMaster, onUpdate,
}: {
  apps: { key: string; label: string; icon: string }[];
  matrix: Record<string, Record<string, Record<string, boolean>>>;
  isMaster: boolean;
  onUpdate: (role: string, appKey: string, field: string, val: boolean) => void;
}) {
  const editableRoles = ["admin", "member", "moderador"];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-semibold text-muted-foreground w-40">App</th>
            {/* Master column (locked) */}
            <th className="py-2 px-2 text-center min-w-[96px]">
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", ROLE_META.owner.color, ROLE_META.owner.bg)}>
                <Lock className="size-2.5" /> Master
              </span>
            </th>
            {editableRoles.map((r) => (
              <th key={r} className="py-2 px-2 text-center min-w-[96px]">
                <RoleBadge role={r} size="xs" />
              </th>
            ))}
          </tr>
          <tr className="border-b bg-muted/20">
            <th />
            {/* Master perms header */}
            <th className="py-1 px-2">
              <div className="flex justify-center gap-1">
                {PERM_KEYS.map((k) => <span key={k} title={PERM_LABELS[k].label} className="text-[9px] text-muted-foreground w-6 text-center">{PERM_LABELS[k].label}</span>)}
              </div>
            </th>
            {editableRoles.map((r) => (
              <th key={r} className="py-1 px-2">
                <div className="flex justify-center gap-1">
                  {PERM_KEYS.map((k) => <span key={k} title={PERM_LABELS[k].label} className="text-[9px] text-muted-foreground w-6 text-center">{PERM_LABELS[k].label}</span>)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => (
            <tr key={app.key} className="border-b hover:bg-muted/10 transition-colors">
              <td className="py-2 px-3 font-medium">
                <span className="mr-1.5">{app.icon}</span>{app.label}
              </td>
              {/* Master — always full, locked */}
              <td className="py-2 px-2">
                <div className="flex justify-center gap-1">
                  {PERM_KEYS.map((k) => (
                    <div key={k} className="w-6 flex justify-center" title={PERM_LABELS[k].label}>
                      <CheckCircle2 className="size-3.5 text-violet-500" />
                    </div>
                  ))}
                </div>
              </td>
              {/* Editable roles */}
              {editableRoles.map((role) => (
                <td key={role} className="py-2 px-2">
                  <div className="flex justify-center gap-1">
                    {PERM_KEYS.map((k) => {
                      const val = matrix[role]?.[app.key]?.[k] ?? false;
                      return (
                        <div key={k} className="w-6 flex justify-center" title={PERM_LABELS[k].label}>
                          {isMaster ? (
                            <Switch
                              checked={val}
                              onCheckedChange={(v) => onUpdate(role, app.key, k, v)}
                              className="scale-50 -m-1.5"
                            />
                          ) : val ? (
                            <CheckCircle2 className="size-3.5 text-emerald-500" />
                          ) : (
                            <AlertCircle className="size-3.5 text-slate-300" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PermissionsTab() {
  const { data: session } = authClient.useSession();
  const qc = useQueryClient();
  const [showMatrix, setShowMatrix] = useState(true);
  const [showLogs, setShowLogs] = useState(false);

  const { data, isLoading } = useQuery({
    ...orpc.permissions.getPermissions.queryOptions(),
  });

  const { mutate: updatePerm } = useMutation({
    mutationFn: (v: { role: string; appKey: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }) =>
      orpc.permissions.updatePermission.call(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["permissions"] }); toast.success("Permissão atualizada"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar permissão"),
  });

  const { mutate: updateRole } = useMutation({
    mutationFn: (v: { memberId: string; role: "owner" | "admin" | "member" | "moderador" }) =>
      orpc.permissions.updateMemberRole.call(v),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Cargo atualizado"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar cargo"),
  });

  const { mutate: removeMember } = useMutation({
    mutationFn: (memberId: string) => orpc.permissions.removeMember.call({ memberId }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Membro removido"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover membro"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const currentMember = data?.members.find((m) => m.userId === session?.user.id);
  const isMaster = currentMember?.role === "owner";
  const isModerador = currentMember?.role === "moderador";
  const canManage = isMaster || isModerador;

  const handlePermUpdate = (role: string, appKey: string, field: string, val: boolean) => {
    const cur = data?.matrix?.[role]?.[appKey];
    if (!cur) return;
    updatePerm({
      role, appKey,
      canView: field === "canView" ? val : cur.canView,
      canCreate: field === "canCreate" ? val : cur.canCreate,
      canEdit: field === "canEdit" ? val : cur.canEdit,
      canDelete: field === "canDelete" ? val : cur.canDelete,
    });
  };

  return (
    <div className="space-y-8">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Gerenciamento de Permissões</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Controle o acesso de cada tipo de usuário aos apps e ferramentas da empresa
          </p>
        </div>
        {currentMember && (
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground mb-1">Seu cargo</p>
            <RoleBadge role={currentMember.role} />
          </div>
        )}
      </div>

      {/* ── Role legend ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(ROLE_META).map(([role, meta]) => (
          <div key={role} className={cn("rounded-xl border p-3 space-y-1", meta.bg, meta.border)}>
            <span className={cn("text-xs font-bold", meta.color)}>{meta.label}</span>
            <p className="text-[11px] text-muted-foreground">{meta.description}</p>
          </div>
        ))}
      </div>

      {/* ── Members table ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Users className="size-4" /> Participantes ({data?.members.length ?? 0})
          </h3>
          <span className="text-xs text-muted-foreground">
            ⭐ {(data?.starsBalance ?? 0).toLocaleString("pt-BR")} stars na conta
          </span>
        </div>

        <div className="rounded-xl border overflow-hidden">
          {data?.members.map((member, i) => {
            const isMe = member.userId === session?.user.id;
            const meta = ROLE_META[member.role];
            return (
              <div
                key={member.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors",
                  i < (data.members.length - 1) && "border-b",
                  isMe && "bg-muted/20",
                )}
              >
                <Avatar className="size-9 shrink-0">
                  <AvatarImage src={member.user.image ?? ""} alt={member.user.name} />
                  <AvatarFallback className="text-xs">{initials(member.user.name)}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{member.user.name}</span>
                    {isMe && <span className="text-[10px] text-muted-foreground">(você)</span>}
                    <RoleBadge role={member.role} size="xs" />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Entrou em {new Date(member.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>

                {/* Actions — only if canManage and not self (unless master changing own role) */}
                {canManage && !isMe && (
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Role selector */}
                    <Select
                      value={member.role}
                      onValueChange={(val) =>
                        updateRole({ memberId: member.id, role: val as any })
                      }
                      disabled={!isMaster && member.role === "owner"}
                    >
                      <SelectTrigger className="h-7 text-xs w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Master</SelectItem>
                        <SelectItem value="admin">Adm</SelectItem>
                        <SelectItem value="member">Single</SelectItem>
                        <SelectItem value="moderador">Moderador</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Remove */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive">
                          <UserX className="size-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover {member.user.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O usuário perderá acesso imediato à empresa. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeMember(member.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Permission Matrix ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <button
          className="flex items-center gap-2 text-base font-semibold w-full text-left"
          onClick={() => setShowMatrix((v) => !v)}
        >
          <Shield className="size-4" />
          Matriz de Permissões
          {showMatrix ? <ChevronUp className="size-4 ml-auto" /> : <ChevronDown className="size-4 ml-auto" />}
        </button>

        {showMatrix && (
          <div className="rounded-xl border overflow-hidden">
            {!isMaster && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b text-xs text-amber-700 dark:text-amber-400">
                <Lock className="size-3.5" /> Apenas o Master pode editar as permissões
              </div>
            )}
            <div className="p-2">
              <PermissionMatrix
                apps={data?.apps ?? []}
                matrix={data?.matrix ?? {}}
                isMaster={isMaster}
                onUpdate={handlePermUpdate}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Activity log ──────────────────────────────────────────────────── */}
      {canManage && (
        <div className="space-y-3">
          <button
            className="flex items-center gap-2 text-base font-semibold w-full text-left"
            onClick={() => setShowLogs((v) => !v)}
          >
            <Clock className="size-4" />
            Histórico de Atividades
            {showLogs ? <ChevronUp className="size-4 ml-auto" /> : <ChevronDown className="size-4 ml-auto" />}
          </button>

          {showLogs && (
            <div className="rounded-xl border overflow-hidden divide-y">
              {(data?.logs ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Nenhuma atividade registrada ainda.</p>
              ) : (
                data?.logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/10">
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-1.5 shrink-0",
                      log.action === "member_removed" ? "bg-red-500" :
                      log.action === "role_changed" ? "bg-blue-500" :
                      log.action === "permission_updated" ? "bg-violet-500" : "bg-slate-400"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{log.userName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {log.action === "role_changed" && `Cargo de ${log.resource} alterado`}
                        {log.action === "member_removed" && `Removeu ${log.resource} da empresa`}
                        {log.action === "permission_updated" && `Permissão atualizada: ${log.resource}`}
                        {!["role_changed","member_removed","permission_updated"].includes(log.action) && log.action}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(log.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Stars usage ───────────────────────────────────────────────────── */}
      {isMaster && (data?.starTransactions?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Star className="size-4 text-yellow-500" /> Consumo de Stars (últimas 200 transações)
          </h3>
          <div className="rounded-xl border overflow-hidden divide-y max-h-52 overflow-y-auto">
            {data?.starTransactions.map((tx, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/10">
                <div>
                  <p className="text-xs font-medium">{tx.description}</p>
                  {tx.appSlug && <p className="text-[10px] text-muted-foreground">{tx.appSlug}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-red-500">{tx.amount.toLocaleString("pt-BR")} ⭐</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
