"use client";

import { useState } from "react";
import Link from "next/link";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, ShieldCheck, UserPlus, Trash2, UserMinus, Pencil, Check, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AdminCreateUserModal } from "./admin-create-user-modal";

const ROLES = ["owner", "admin", "member", "moderador"] as const;
const ROLE_LABELS: Record<string, string> = { owner: "Master", admin: "Adm", member: "Single", moderador: "Moderador" };
const ROLE_COLORS: Record<string, string> = {
  owner:     "bg-violet-500/20 text-violet-300 border-violet-500/30",
  admin:     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  member:    "bg-zinc-700/60 text-zinc-300 border-zinc-600/30",
  moderador: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

type Member = {
  id: string;
  role: string;
  cargo?: string | null;
  createdAt: Date;
  user: { id: string; name: string; email: string; image: string | null; isSystemAdmin: boolean };
};

interface EditState {
  memberId: string;
  name: string;
  role: string;
  cargo: string;
}

export function OrgMembersTable({ members: initialMembers, orgId, orgName }: { members: Member[]; orgId: string; orgName?: string }) {
  const qc = useQueryClient();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ memberId: string; userId: string; type: "remove" | "delete" } | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateM = useMutation({
    ...orpc.admin.updateMember.mutationOptions(),
    onSuccess: () => {
      toast.success("Membro atualizado");
      setEditing(null);
      qc.invalidateQueries();
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const adminM = useMutation({
    ...orpc.admin.setSystemAdmin.mutationOptions(),
    onSuccess: () => { toast.success("Permissão atualizada"); qc.invalidateQueries(); },
    onError: () => toast.error("Erro ao alterar permissão"),
  });

  const removeM = useMutation({
    ...orpc.admin.removeMember.mutationOptions(),
    onSuccess: () => {
      toast.success("Membro removido da empresa");
      setConfirmDelete(null);
      qc.invalidateQueries();
      setMembers((prev) => prev.filter((m) => m.id !== confirmDelete?.memberId));
    },
    onError: () => toast.error("Erro ao remover membro"),
  });

  const deleteM = useMutation({
    ...orpc.admin.deleteUser.mutationOptions(),
    onSuccess: () => {
      toast.success("Usuário excluído do sistema");
      setConfirmDelete(null);
      qc.invalidateQueries();
      setMembers((prev) => prev.filter((m) => m.id !== confirmDelete?.memberId));
    },
    onError: () => toast.error("Erro ao excluir usuário"),
  });

  const startEdit = (m: Member) => setEditing({ memberId: m.id, name: m.user.name, role: m.role, cargo: m.cargo ?? "" });

  const saveEdit = () => {
    if (!editing) return;
    updateM.mutate({
      memberId: editing.memberId,
      name:     editing.name,
      role:     editing.role as typeof ROLES[number],
      cargo:    editing.cargo || null,
    });
  };

  const cancelEdit = () => setEditing(null);

  return (
    <>
      {/* Create user modal */}
      {showCreate && (
        <AdminCreateUserModal
          orgId={orgId}
          orgName={orgName ?? ""}
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries()}
        />
      )}

      {/* Confirm dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {confirmDelete.type === "remove" ? "Remover da empresa?" : "Excluir usuário?"}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {confirmDelete.type === "remove"
                    ? "O usuário perderá o acesso à empresa, mas sua conta permanece no sistema."
                    : "Esta ação é irreversível. O usuário será excluído de todo o sistema."}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (confirmDelete.type === "remove") removeM.mutate({ memberId: confirmDelete.memberId });
                  else deleteM.mutate({ userId: confirmDelete.userId });
                }}
                disabled={removeM.isPending || deleteM.isPending}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {(removeM.isPending || deleteM.isPending) ? "Aguarde..." : confirmDelete.type === "remove" ? "Remover" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Membros <span className="text-zinc-500 font-normal">({members.length})</span>
          </h2>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Novo usuário
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-[11px] uppercase tracking-wide border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-5 py-3">Usuário</th>
                <th className="text-left px-3 py-3">Função</th>
                <th className="text-left px-3 py-3">Cargo</th>
                <th className="text-center px-3 py-3">Admin</th>
                <th className="text-right px-3 py-3">Desde</th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {members.map((m) => {
                const isEditing = editing?.memberId === m.id;
                return (
                  <tr key={m.id} className="hover:bg-zinc-800/30 transition-colors group">

                    {/* User */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        {m.user.image
                          ? <img src={m.user.image} className="w-8 h-8 rounded-full shrink-0 object-cover" />
                          : <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-[11px] font-bold text-zinc-300 shrink-0">{m.user.name[0]?.toUpperCase()}</div>
                        }
                        <div className="min-w-0">
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editing.name}
                              onChange={(e) => setEditing((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                              className="w-full px-2 py-1 bg-zinc-700 border border-violet-500/60 rounded text-xs text-white focus:outline-none"
                            />
                          ) : (
                            <p className="text-xs font-medium text-white truncate">{m.user.name}</p>
                          )}
                          <p className="text-[11px] text-zinc-500 truncate">{m.user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-3 py-3">
                      {isEditing ? (
                        <select
                          value={editing.role}
                          onChange={(e) => setEditing((prev) => prev ? { ...prev, role: e.target.value } : prev)}
                          className="px-2 py-1 bg-zinc-700 border border-violet-500/60 rounded text-xs text-white focus:outline-none"
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      ) : (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${ROLE_COLORS[m.role] ?? ROLE_COLORS.member}`}>
                          {ROLE_LABELS[m.role] ?? m.role}
                        </span>
                      )}
                    </td>

                    {/* Cargo */}
                    <td className="px-3 py-3">
                      {isEditing ? (
                        <input
                          value={editing.cargo}
                          onChange={(e) => setEditing((prev) => prev ? { ...prev, cargo: e.target.value } : prev)}
                          placeholder="Cargo (opcional)"
                          className="w-28 px-2 py-1 bg-zinc-700 border border-violet-500/60 rounded text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                        />
                      ) : (
                        <span className="text-xs text-zinc-400">{m.cargo || <span className="text-zinc-600">—</span>}</span>
                      )}
                    </td>

                    {/* System admin toggle */}
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => adminM.mutate({ userId: m.user.id, isSystemAdmin: !m.user.isSystemAdmin })}
                        disabled={adminM.isPending}
                        title={m.user.isSystemAdmin ? "Revogar admin de sistema" : "Conceder admin de sistema"}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${
                          m.user.isSystemAdmin
                            ? "bg-violet-500/20 text-violet-300 border-violet-500/30 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30"
                            : "bg-zinc-800 text-zinc-600 border-zinc-700 hover:bg-violet-500/20 hover:text-violet-300 hover:border-violet-500/30"
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        {m.user.isSystemAdmin ? "Admin" : "—"}
                      </button>
                    </td>

                    {/* Date */}
                    <td className="px-3 py-3 text-right text-[11px] text-zinc-500 whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={saveEdit}
                            disabled={updateM.isPending}
                            className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={cancelEdit} className="p-1.5 bg-zinc-700 text-zinc-400 hover:bg-zinc-600 rounded-lg transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Edit */}
                          <button
                            onClick={() => startEdit(m)}
                            title="Editar"
                            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* View full profile */}
                          <Link
                            href={`/admin/users/${m.user.id}`}
                            title="Ver perfil completo"
                            className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-zinc-700 rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>

                          {/* Remove from org */}
                          <button
                            onClick={() => setConfirmDelete({ memberId: m.id, userId: m.user.id, type: "remove" })}
                            title="Remover da empresa"
                            className="p-1.5 text-zinc-500 hover:text-orange-400 hover:bg-zinc-700 rounded-lg transition-colors"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete globally */}
                          <button
                            onClick={() => setConfirmDelete({ memberId: m.id, userId: m.user.id, type: "delete" })}
                            title="Excluir do sistema"
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-700 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {members.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-zinc-500">
                    Nenhum membro nesta empresa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
