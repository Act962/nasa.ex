"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAdminAdjust } from "./hooks";

export function AdjustModal({ userId, orgId, userName, totalPoints, onClose }: {
  userId: string; orgId: string; userName: string; totalPoints: number; onClose: () => void;
}) {
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const { mutateAsync, isPending } = useAdminAdjust();

  const handleSubmit = async () => {
    if (amount === 0) return toast.error("Insira um valor diferente de 0");
    await mutateAsync({ userId, orgId, points: amount, description: reason || (amount > 0 ? "Pontos adicionados pelo admin" : "Pontos removidos pelo admin") });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-80 space-y-4">
        <h3 className="text-sm font-bold text-white">Ajustar pontos — {userName}</h3>
        <p className="text-xs text-zinc-400">Total atual: <span className="text-violet-300 font-bold">{totalPoints.toLocaleString("pt-BR")} pts</span></p>
        <div className="space-y-2">
          <label className="text-xs text-zinc-400">Valor (positivo = adicionar, negativo = remover)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
            className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-violet-500" />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-zinc-400">Motivo (opcional)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Premiação do mês"
            className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-violet-500" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 text-sm py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Cancelar</button>
          <button onClick={handleSubmit} disabled={isPending || amount === 0}
            className="flex-1 text-sm py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
            {isPending ? "..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
