"use client";

import { useState } from "react";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, UserPlus, Copy, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["member", "admin", "owner", "moderador"] as const;
const ROLE_LABELS: Record<string, string> = {
  owner: "Master", admin: "Adm", member: "Single", moderador: "Moderador",
};

interface Props {
  orgId: string;
  orgName: string;
  onClose: () => void;
  onCreated: () => void;
}

export function AdminCreateUserModal({ orgId, orgName, onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", role: "member" as typeof ROLES[number], cargo: "" });
  const [result, setResult] = useState<{ tempPassword: string | null; isNewUser: boolean; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const mutation = useMutation({
    ...orpc.admin.createOrgUser.mutationOptions(),
    onSuccess: (data) => {
      setResult({ tempPassword: data.tempPassword, isNewUser: data.isNewUser, name: form.name });
      qc.invalidateQueries();
    },
    onError: (e: any) => {
      const msg = e?.message?.includes("BAD_REQUEST") ? "Este e-mail já é membro desta empresa." : "Erro ao criar usuário.";
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ orgId, name: form.name, email: form.email, role: form.role, cargo: form.cargo || undefined });
  };

  const copyPassword = () => {
    if (!result?.tempPassword) return;
    navigator.clipboard.writeText(result.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDone = () => { onCreated(); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Novo usuário</h2>
            <span className="text-xs text-zinc-500">· {orgName}</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success state */}
        {result ? (
          <div className="px-6 py-6 space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-white font-semibold">{result.isNewUser ? "Usuário criado!" : "Membro adicionado!"}</p>
              <p className="text-xs text-zinc-400">
                {result.name} foi adicionado(a) à empresa com sucesso.
              </p>
            </div>

            {result.isNewUser && result.tempPassword && (
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 space-y-3">
                <p className="text-xs text-zinc-400 font-medium">Senha temporária gerada:</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-sm font-bold text-violet-300 bg-zinc-900 px-3 py-2 rounded-lg tracking-wider">
                    {showPass ? result.tempPassword : "•".repeat(result.tempPassword.length)}
                  </div>
                  <button onClick={() => setShowPass((v) => !v)} className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={copyPassword} className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors">
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-yellow-500/80">⚠ Compartilhe esta senha com o usuário. Ela não será exibida novamente.</p>
              </div>
            )}

            <button onClick={handleDone} className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
              Concluir
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1.5">Nome completo *</label>
                <input
                  required minLength={2}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="João Silva"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1.5">E-mail *</label>
                <input
                  required type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="joao@empresa.com"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Função</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as typeof ROLES[number] }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Cargo <span className="text-zinc-600">(opcional)</span></label>
                <input
                  value={form.cargo}
                  onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                  placeholder="Ex: Vendedor"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>

            <p className="text-[11px] text-zinc-500">
              Se o e-mail já estiver cadastrado no sistema, o usuário será adicionado à empresa sem criar nova conta.
              Caso contrário, uma senha temporária será gerada.
            </p>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl transition-colors">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {mutation.isPending ? "Criando..." : "Criar usuário"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
