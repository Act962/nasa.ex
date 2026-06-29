"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Hooks pro CRUD de Agentes IA.
 *  - useAgents({ trackingId? }) — lista (cache 30s)
 *  - useCreateAgent — mutation com invalidação de tracking.list (cards)
 *  - useUpdateAgent — toggle isActive, mudanças de config
 *  - useDeleteAgent — Cascade apaga sessions
 *  - useStartAgentForLead — abre LeadAgentSession + dispatch Inngest
 */

export function useAgents(opts: { trackingId?: string } = {}) {
  return useQuery({
    ...orpc.agents.list.queryOptions({
      input: opts.trackingId ? { trackingId: opts.trackingId } : {},
    }),
    staleTime: 30_000,
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation(
    orpc.agents.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Agente "${data.name}" criado!`);
        qc.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) && q.queryKey[0] === "agents",
        });
      },
      onError: (err) => toast.error(`Erro ao criar: ${err.message}`),
    }),
  );
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation(
    orpc.agents.update.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) && q.queryKey[0] === "agents",
        });
      },
      onError: (err) => toast.error(`Erro ao atualizar: ${err.message}`),
    }),
  );
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation(
    orpc.agents.delete.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Agente "${data.name}" excluído`);
        qc.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) && q.queryKey[0] === "agents",
        });
      },
      onError: (err) => toast.error(`Erro ao excluir: ${err.message}`),
    }),
  );
}

export function useStartAgentForLead() {
  return useMutation(
    orpc.agents.startSession.mutationOptions({
      onSuccess: () => {
        toast.success("Agente ativado pra esse lead");
      },
      onError: (err) =>
        toast.error(`Erro ao iniciar sessão: ${err.message}`),
    }),
  );
}
