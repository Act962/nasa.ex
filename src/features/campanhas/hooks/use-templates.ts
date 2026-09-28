import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Hooks de templates de marketing (Campanhas — Fase 2). A listagem busca ao
 * vivo na Graph API (por WABA do número de origem); a criação invalida a lista.
 */

export const useTemplates = (
  trackingId: string | undefined,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    ...orpc.campanhas.listTemplates.queryOptions({
      input: { trackingId: trackingId ?? "" },
    }),
    enabled: Boolean(trackingId) && (options?.enabled ?? true),
    staleTime: 15_000,
  });
};

export const useCreateTemplate = (trackingId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.createTemplate.mutationOptions({
      onSuccess: () => {
        if (!trackingId) return;
        queryClient.invalidateQueries({
          queryKey: orpc.campanhas.listTemplates.key({ input: { trackingId } }),
        });
      },
    }),
  );
};

export const useUploadTemplateSample = () => {
  return useMutation(orpc.campanhas.uploadTemplateSample.mutationOptions());
};
