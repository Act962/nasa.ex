"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { ShieldCheck, Trash2 } from "lucide-react";

interface User {
  id: string;
  name: string;
  nickname: string | null;
  isSystemAdmin: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export function UserEditForm({ user, isSelf }: { user: User; isSelf: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [nickname, setNickname] = useState(user.nickname ?? "");
  const [saved, setSaved] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const updateMut = useMutation({
    mutationFn: (data: { name: string; nickname: string | null }) =>
      orpc.admin.updateUser.call({ userId: user.id, ...data }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    },
  });

  const adminMut = useMutation({
    mutationFn: (isSystemAdmin: boolean) =>
      orpc.admin.updateUser.call({ userId: user.id, isSystemAdmin }),
    onSuccess: () => router.refresh(),
  });

  const deleteMut = useMutation({
    mutationFn: () => orpc.admin.deleteUser.call({ userId: user.id }),
    onSuccess: () => router.push("/admin/users"),
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
      <h2 className="text-sm font-semibold text-white">Editar usuário</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Apelido</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Opcional"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => updateMut.mutate({ name, nickname: nickname || null })}
          disabled={updateMut.isPending}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          {updateMut.isPending ? "Salvando..." : saved ? "Salvo ✓" : "Salvar"}
        </button>
        {updateMut.isError && (
          <p className="text-xs text-red-400">Erro ao salvar.</p>
        )}
      </div>

      <div className="border-t border-zinc-800 pt-4 flex items-center justify-between">
        {/* Admin toggle */}
        <div className="flex items-center gap-3">
          <ShieldCheck className={`w-4 h-4 ${user.isSystemAdmin ? "text-violet-400" : "text-zinc-600"}`} />
          <div>
            <p className="text-sm text-white">Moderador do sistema</p>
            <p className="text-xs text-zinc-500">Acesso total ao painel admin</p>
          </div>
          <button
            onClick={() => adminMut.mutate(!user.isSystemAdmin)}
            disabled={adminMut.isPending || isSelf}
            title={isSelf ? "Você não pode alterar o seu próprio status" : undefined}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 ${
              user.isSystemAdmin ? "bg-violet-600" : "bg-zinc-700"
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              user.isSystemAdmin ? "translate-x-4.5" : "translate-x-0.5"
            }`} />
          </button>
        </div>

        {/* Delete */}
        {!isSelf && (
          <div>
            {!showDelete ? (
              <button
                onClick={() => setShowDelete(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir usuário
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xs text-red-400">Confirmar exclusão?</p>
                <button
                  onClick={() => deleteMut.mutate()}
                  disabled={deleteMut.isPending}
                  className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {deleteMut.isPending ? "..." : "Sim, excluir"}
                </button>
                <button
                  onClick={() => setShowDelete(false)}
                  className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
