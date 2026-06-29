"use client";

import { useState } from "react";
import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";

interface Plan { id: string; name: string; monthlyStars: number; priceMonthly: number }
interface Props { orgId: string; currentPlanId: string | null; plans: Plan[] }

export function OrgPlanForm({ orgId, currentPlanId, plans }: Props) {
  const [selectedPlanId, setSelectedPlanId] = useState(currentPlanId ?? "");

  const mutation = useMutation({
    ...orpc.admin.updateOrgPlan.mutationOptions(),
    onSuccess: () => toast.success("Plano atualizado com sucesso"),
    onError: () => toast.error("Erro ao atualizar plano"),
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-violet-400" /> Plano Ativo
      </h2>

      <div className="space-y-3">
        {plans.map((p) => (
          <label
            key={p.id}
            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedPlanId === p.id
                ? "border-violet-500/60 bg-violet-500/10"
                : "border-zinc-700 hover:border-zinc-600"
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="plan"
                value={p.id}
                checked={selectedPlanId === p.id}
                onChange={() => setSelectedPlanId(p.id)}
                className="accent-violet-500"
              />
              <div>
                <p className="text-sm font-medium text-white">{p.name}</p>
                <p className="text-[11px] text-zinc-500">{p.monthlyStars.toLocaleString("pt-BR")} ⭐/mês</p>
              </div>
            </div>
            <span className="text-sm font-semibold text-violet-300">
              R$ {p.priceMonthly.toFixed(2)}
            </span>
          </label>
        ))}

        <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${!selectedPlanId ? "border-zinc-500 bg-zinc-800" : "border-zinc-700 hover:border-zinc-600"}`}>
          <input type="radio" name="plan" value="" checked={!selectedPlanId} onChange={() => setSelectedPlanId("")} className="accent-violet-500" />
          <p className="text-sm text-zinc-400">Sem plano</p>
        </label>

        <button
          onClick={() => mutation.mutate({ orgId, planId: selectedPlanId || null })}
          disabled={mutation.isPending || selectedPlanId === (currentPlanId ?? "")}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 rounded-lg transition-colors mt-1"
        >
          {mutation.isPending ? "Salvando..." : "Salvar Plano"}
        </button>
      </div>
    </div>
  );
}
