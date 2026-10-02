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
    <div className="bg-card border border-border rounded-xl p-5 space-y-5">
      <h2 className="text-sm font-semibold text-foreground">Editar usuário</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-muted border border-line rounded-lg text-sm text-foreground focus:outline-none focus:border-ring"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Apelido</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Opcional"
            className="w-full px-3 py-2 bg-muted border border-line rounded-lg text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-ring"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => updateMut.mutate({ name, nickname: nickname || null })}
          disabled={updateMut.isPending}
          className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm rounded-lg transition-colors"
        >
          {updateMut.isPending ? "Salvando..." : saved ? "Salvo ✓" : "Salvar"}
        </button>
        {updateMut.isError && (
          <p className="text-xs text-destructive">Erro ao salvar.</p>
        )}
      </div>

      <div className="border-t border-border pt-4 flex items-center justify-between">
        {/* Admin toggle */}
        <div className="flex items-center gap-3">
          <ShieldCheck className={`w-4 h-4 ${user.isSystemAdmin ? "text-info" : "text-muted-foreground/70"}`} />
          <div>
            <p className="text-sm text-foreground">Moderador do sistema</p>
            <p className="text-xs text-muted-foreground">Acesso total ao painel admin</p>
          </div>
          <button
            onClick={() => adminMut.mutate(!user.isSystemAdmin)}
            disabled={adminMut.isPending || isSelf}
            title={isSelf ? "Você não pode alterar o seu próprio status" : undefined}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 ${
              user.isSystemAdmin ? "bg-primary" : "bg-knob"
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform ${
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
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir usuário
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xs text-destructive">Confirmar exclusão?</p>
                <button
                  onClick={() => deleteMut.mutate()}
                  disabled={deleteMut.isPending}
                  className="px-3 py-1 text-xs bg-destructive/15 text-destructive hover:bg-destructive/25 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {deleteMut.isPending ? "..." : "Sim, excluir"}
                </button>
                <button
                  onClick={() => setShowDelete(false)}
                  className="px-3 py-1 text-xs bg-knob hover:bg-knob text-foreground rounded-lg transition-colors"
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
