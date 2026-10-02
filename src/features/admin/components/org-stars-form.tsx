"use client";

import { useState } from "react";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

interface Props { orgId: string; currentBalance: number }

export function OrgStarsForm({ orgId, currentBalance }: Props) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [operation, setOperation] = useState<"add" | "remove">("add");
  const qc = useQueryClient();

  const mutation = useMutation({
    ...orpc.admin.adjustStars.mutationOptions(),
    onSuccess: (data) => {
      toast.success(`Saldo atualizado: ${data.newBalance.toLocaleString("pt-BR")} ⭐`);
      setAmount("");
      setDescription("");
      qc.invalidateQueries();
    },
    onError: () => toast.error("Erro ao ajustar stars"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(amount, 10);
    if (!n || !description.trim()) return;
    mutation.mutate({
      orgId,
      amount: operation === "add" ? Math.abs(n) : -Math.abs(n),
      description: description.trim(),
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
        <Star className="w-4 h-4 text-warning" /> Gerenciar Stars
      </h2>
      <p className="text-xs text-muted-foreground mb-4">Saldo atual: <span className="text-warning font-semibold">{currentBalance.toLocaleString("pt-BR")}</span></p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOperation("add")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${operation === "add" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground hover:bg-knob"}`}
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
          <button
            type="button"
            onClick={() => setOperation("remove")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${operation === "remove" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground hover:bg-knob"}`}
          >
            <Minus className="w-3.5 h-3.5" /> Remover
          </button>
        </div>

        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Quantidade de stars"
          className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30"
        />
        <input
          type="text"
          maxLength={200}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Motivo / descrição (obrigatório)"
          className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30"
        />
        <button
          type="submit"
          disabled={mutation.isPending || !amount || !description}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-semibold py-2 rounded-lg transition-colors"
        >
          {mutation.isPending ? "Aplicando..." : `${operation === "add" ? "Adicionar" : "Remover"} Stars`}
        </button>
      </form>
    </div>
  );
}
