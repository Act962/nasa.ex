"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SimulationInput } from "@/features/forge/schema/simulator-schema";

export function useForgeSimulations(mode?: "COMERCIAL" | "LICITACAO") {
  return useQuery(
    orpc.forge.simulations.list.queryOptions({ input: { mode } }),
  );
}

export function useForgeSimulation(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    ...orpc.forge.simulations.get.queryOptions({ input: { id: id ?? "" } }),
    enabled: (options?.enabled ?? true) && Boolean(id),
  });
}

function useInvalidateSimulations() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: orpc.forge.simulations.list.key() });
}

export function useCreateForgeSimulation() {
  const invalidate = useInvalidateSimulations();
  return useMutation({
    ...orpc.forge.simulations.create.mutationOptions(),
    onSuccess: invalidate,
  });
}

export function useUpdateForgeSimulation() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.simulations.update.mutationOptions(),
    onSuccess: (_data, variables: SimulationInput & { id: string }) => {
      qc.invalidateQueries({ queryKey: orpc.forge.simulations.list.key() });
      if (variables?.id) {
        qc.invalidateQueries({
          queryKey: orpc.forge.simulations.get.queryOptions({ input: { id: variables.id } }).queryKey,
        });
      }
    },
  });
}

export function useDeleteForgeSimulation() {
  const invalidate = useInvalidateSimulations();
  return useMutation({
    ...orpc.forge.simulations.delete.mutationOptions(),
    onSuccess: invalidate,
  });
}

export function useConvertSimulationToProposal() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.simulations.convertToProposal.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orpc.forge.simulations.list.key() });
      qc.invalidateQueries({ queryKey: orpc.forge.proposals.list.key() });
      qc.invalidateQueries({ queryKey: orpc.forge.dashboard.get.key() });
    },
  });
}
