"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IntegrationPlatform } from "@/generated/prisma/enums";

export const useQueryPlatformIntegrations = () => {
  return useQuery(
    orpc.platformIntegrations.getMany.queryOptions({}),
  );
};

export const useUpsertPlatformIntegration = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.platformIntegrations.upsert.mutationOptions({
      onSuccess: () => {
        toast.success("Integração salva com sucesso");
        qc.invalidateQueries({ queryKey: orpc.platformIntegrations.getMany.key({}) });
      },
      onError: (e) => toast.error("Erro ao salvar integração: " + e.message),
    }),
  );
};

export const useDeletePlatformIntegration = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.platformIntegrations.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Integração removida");
        qc.invalidateQueries({ queryKey: orpc.platformIntegrations.getMany.key({}) });
      },
      onError: (e) => toast.error("Erro ao remover integração: " + e.message),
    }),
  );
};

export type { IntegrationPlatform };
