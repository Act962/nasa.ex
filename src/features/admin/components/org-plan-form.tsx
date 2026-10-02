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
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-info" /> Plano Ativo
      </h2>

      <div className="space-y-3">
        {plans.map((p) => (
          <label
            key={p.id}
            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedPlanId === p.id
                ? "border-info/50 bg-info/10"
                : "border-border hover:border-knob"
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="plan"
                value={p.id}
                checked={selectedPlanId === p.id}
                onChange={() => setSelectedPlanId(p.id)}
                className="accent-primary"
              />
              <div>
                <p className="text-sm font-medium text-foreground">{p.name}</p>
                <p className="text-[11px] text-muted-foreground">{p.monthlyStars.toLocaleString("pt-BR")} ⭐/mês</p>
              </div>
            </div>
            <span className="text-sm font-semibold text-info">
              R$ {p.priceMonthly.toFixed(2)}
            </span>
          </label>
        ))}

        <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${!selectedPlanId ? "border-knob bg-panel" : "border-border hover:border-knob"}`}>
          <input type="radio" name="plan" value="" checked={!selectedPlanId} onChange={() => setSelectedPlanId("")} className="accent-primary" />
          <p className="text-sm text-muted-foreground">Sem plano</p>
        </label>

        <button
          onClick={() => mutation.mutate({ orgId, planId: selectedPlanId || null })}
          disabled={mutation.isPending || selectedPlanId === (currentPlanId ?? "")}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-semibold py-2 rounded-lg transition-colors mt-1"
        >
          {mutation.isPending ? "Salvando..." : "Salvar Plano"}
        </button>
      </div>
    </div>
  );
}
