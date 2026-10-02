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
      <div className="bg-card border border-line rounded-2xl w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-info" />
            <h2 className="text-sm font-semibold text-foreground">Novo usuário</h2>
            <span className="text-xs text-muted-foreground">· {orgName}</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success state */}
        {result ? (
          <div className="px-6 py-6 space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-success" />
              </div>
              <p className="text-foreground font-semibold">{result.isNewUser ? "Usuário criado!" : "Membro adicionado!"}</p>
              <p className="text-xs text-muted-foreground">
                {result.name} foi adicionado(a) à empresa com sucesso.
              </p>
            </div>

            {result.isNewUser && result.tempPassword && (
              <div className="bg-muted border border-line rounded-xl p-4 space-y-3">
                <p className="text-xs text-muted-foreground font-medium">Senha temporária gerada:</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-sm font-bold text-info bg-card px-3 py-2 rounded-lg tracking-wider">
                    {showPass ? result.tempPassword : "•".repeat(result.tempPassword.length)}
                  </div>
                  <button onClick={() => setShowPass((v) => !v)} className="p-2 hover:bg-knob rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={copyPassword} className="p-2 hover:bg-knob rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                    {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-warning/80">⚠ Compartilhe esta senha com o usuário. Ela não será exibida novamente.</p>
              </div>
            )}

            <button onClick={handleDone} className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl transition-colors">
              Concluir
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1.5">Nome completo *</label>
                <input
                  required minLength={2}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="João Silva"
                  className="w-full px-3 py-2 bg-muted border border-line rounded-lg text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-ring transition-colors"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1.5">E-mail *</label>
                <input
                  required type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="joao@empresa.com"
                  className="w-full px-3 py-2 bg-muted border border-line rounded-lg text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-ring transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Função</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as typeof ROLES[number] }))}
                  className="w-full px-3 py-2 bg-muted border border-line rounded-lg text-sm text-foreground focus:outline-none focus:border-ring transition-colors"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Cargo <span className="text-muted-foreground/70">(opcional)</span></label>
                <input
                  value={form.cargo}
                  onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                  placeholder="Ex: Vendedor"
                  className="w-full px-3 py-2 bg-muted border border-line rounded-lg text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-ring transition-colors"
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Se o e-mail já estiver cadastrado no sistema, o usuário será adicionado à empresa sem criar nova conta.
              Caso contrário, uma senha temporária será gerada.
            </p>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-muted hover:bg-knob text-foreground text-sm rounded-xl transition-colors">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-semibold rounded-xl transition-colors"
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
