"use client";

import { useState } from "react";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["owner", "admin", "member", "moderador"] as const;
const ROLE_LABELS: Record<string, string> = {
  owner: "Master", admin: "Adm", member: "Single", moderador: "Moderador",
};
const ROLE_COLORS: Record<string, string> = {
  owner: "bg-violet-500/20 text-violet-300",
  admin: "bg-blue-500/20 text-blue-300",
  member: "bg-zinc-700 text-zinc-300",
  moderador: "bg-orange-500/20 text-orange-300",
};

type Member = {
  id: string;
  role: string;
  createdAt: Date;
  user: { id: string; name: string; email: string; image: string | null; isSystemAdmin: boolean };
};

interface Props { members: Member[]; orgId: string }

export function OrgMembersTable({ members, orgId: _orgId }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const roleM = useMutation({
    ...orpc.admin.updateMemberRole.mutationOptions(),
    onSuccess: () => { toast.success("Cargo atualizado"); setEditingId(null); qc.invalidateQueries(); },
    onError: () => toast.error("Erro ao atualizar cargo"),
  });

  const adminM = useMutation({
    ...orpc.admin.setSystemAdmin.mutationOptions(),
    onSuccess: () => { toast.success("Permissão de sistema atualizada"); qc.invalidateQueries(); },
    onError: () => toast.error("Não foi possível alterar permissão de sistema"),
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Users className="w-4 h-4 text-blue-400" /> Membros ({members.length})
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
              <th className="text-left py-2 pr-4">Usuário</th>
              <th className="text-left py-2 pr-4">Cargo</th>
              <th className="text-center py-2 pr-4">Admin Sistema</th>
              <th className="text-right py-2">Desde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {members.map((m) => (
              <tr key={m.id} className="text-xs hover:bg-zinc-800/40 transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    {m.user.image
                      ? <img src={m.user.image} className="w-7 h-7 rounded-full" />
                      : <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300">{m.user.name[0]?.toUpperCase()}</div>
                    }
                    <div>
                      <p className="font-medium text-white">{m.user.name}</p>
                      <p className="text-zinc-500">{m.user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  {editingId === m.id ? (
                    <select
                      autoFocus
                      defaultValue={m.role}
                      onBlur={() => setEditingId(null)}
                      onChange={(e) => roleM.mutate({ memberId: m.id, role: e.target.value as typeof ROLES[number] })}
                      className="bg-zinc-800 border border-violet-500/60 rounded px-2 py-1 text-xs text-white focus:outline-none"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingId(m.id)}
                      className={`px-2 py-1 rounded-full text-[11px] font-semibold transition-opacity hover:opacity-70 ${ROLE_COLORS[m.role] ?? ROLE_COLORS.member}`}
                    >
                      {ROLE_LABELS[m.role] ?? m.role}
                    </button>
                  )}
                </td>
                <td className="py-3 pr-4 text-center">
                  <button
                    onClick={() => adminM.mutate({ userId: m.user.id, isSystemAdmin: !m.user.isSystemAdmin })}
                    disabled={adminM.isPending}
                    title={m.user.isSystemAdmin ? "Revogar admin de sistema" : "Conceder admin de sistema"}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                      m.user.isSystemAdmin
                        ? "bg-violet-500/20 text-violet-300 hover:bg-red-500/20 hover:text-red-300"
                        : "bg-zinc-700 text-zinc-500 hover:bg-violet-500/20 hover:text-violet-300"
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    {m.user.isSystemAdmin ? "Admin" : "—"}
                  </button>
                </td>
                <td className="py-3 text-right text-zinc-500">
                  {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
