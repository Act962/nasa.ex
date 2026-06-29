"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Hooks pro catálogo NASA de Padrões de Tracking.
 *
 *  - `useTrackingPresets()` — lista catálogo (cache 60s, agrupado por paradigma)
 *  - `useTrackingPresetPreview()` — mutation pra dry-run (mostra conflitos)
 *  - `useApplyTrackingPreset()` — mutation pra aplicar (invalida tracking.list +
 *    workflow.list + tags + status; navega user pra novo tracking)
 */

type Paradigm = "REATIVO" | "PROATIVO" | "PREDITIVO" | "AUTOATENDIMENTO";

export function useTrackingPresets(paradigm?: Paradigm) {
  return useQuery({
    ...orpc.trackingPresets.list.queryOptions({
      input: paradigm ? { paradigm } : {},
    }),
    staleTime: 60_000,
  });
}

export function useTrackingPresetDetail(presetId: string | null) {
  return useQuery({
    ...orpc.trackingPresets.getDetail.queryOptions({
      input: { id: presetId ?? "" },
    }),
    enabled: !!presetId,
    staleTime: 60_000,
  });
}

export function useTrackingPresetPreview() {
  return useMutation(orpc.trackingPresets.preview.mutationOptions({}));
}

export function useApplyTrackingPreset() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.trackingPresets.apply.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `Padrão aplicado em "${data.trackingName}" — ${data.summary.workflowsCreated} workflows, ${data.summary.tagsCreated} tags novas`,
        );

        // Invalidações pesadas — várias áreas do app refletem o novo tracking
        queryClient.invalidateQueries({
          queryKey: orpc.tracking.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.tracking.listDashboard.queryKey(),
        });
        queryClient.invalidateQueries({
          predicate: (q) => {
            const key = q.queryKey;
            if (!Array.isArray(key)) return false;
            // workflow, tags, status, tagGroups — tudo pode ter mudado
            return (
              key[0] === "workflow" ||
              key[0] === "tags" ||
              key[0] === "tagGroups" ||
              key[0] === "status"
            );
          },
        });
      },
      onError: (err) => toast.error(`Erro ao aplicar padrão: ${err.message}`),
    }),
  );
}
