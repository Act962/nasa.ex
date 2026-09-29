import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Conexão do WhatsApp oficial pelas chaves do cliente (spec 0040, RF-11/RF-12). */

export const useMetaSetupStatus = (trackingId: string | null, options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.campanhas.metaSetupStatus.queryOptions({ input: { trackingId: trackingId ?? "" } }),
    enabled: Boolean(trackingId) && (options?.enabled ?? true),
    retry: false,
  });
};

function useInvalidateSetup() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.campanhas.metaSetupStatus.key() });
    queryClient.invalidateQueries({ queryKey: orpc.campanhas.numberPanel.key() });
    queryClient.invalidateQueries({ queryKey: orpc.campanhas.listSendingNumbers.key() });
  };
}

export const useSaveMetaKeys = () => {
  const invalidate = useInvalidateSetup();
  return useMutation(orpc.campanhas.saveMetaKeys.mutationOptions({ onSuccess: invalidate }));
};

export const useSelectMetaPhone = () => {
  const invalidate = useInvalidateSetup();
  return useMutation(orpc.campanhas.selectMetaPhone.mutationOptions({ onSuccess: invalidate }));
};

export const useAddMetaNumber = () => {
  return useMutation(orpc.campanhas.addMetaNumber.mutationOptions());
};

export const useRequestMetaCode = () => {
  return useMutation(orpc.campanhas.requestMetaCode.mutationOptions());
};

export const useVerifyMetaCode = () => {
  const invalidate = useInvalidateSetup();
  return useMutation(orpc.campanhas.verifyMetaCode.mutationOptions({ onSuccess: invalidate }));
};

/** Progresso do assistente salvo no banco (spec 0040, RF-14). */
export const useConnectProgress = (trackingId: string | null, options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.campanhas.connectProgress.queryOptions({ input: { trackingId: trackingId ?? "" } }),
    enabled: Boolean(trackingId) && (options?.enabled ?? true),
    staleTime: Infinity,
  });
};

export const useSaveConnectProgress = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.saveConnectProgress.mutationOptions({
      // O passo atual vai para o cache na hora: respostas que chegam fora de
      // ordem (banco lento) não podem trazer o cliente de volta a um passo antigo.
      onMutate: (input) => {
        const queryKey = orpc.campanhas.connectProgress.queryKey({ input: { trackingId: input.trackingId } });
        if (input.guideSlug === undefined) return;
        queryClient.setQueryData(queryKey, (current) => (current ? { ...current, guideSlug: input.guideSlug ?? null } : current));
      },
      onSuccess: (progress, input) => {
        const queryKey = orpc.campanhas.connectProgress.queryKey({ input: { trackingId: input.trackingId } });
        queryClient.setQueryData(queryKey, (current) => (current ? { ...progress, guideSlug: current.guideSlug } : progress));
      },
    }),
  );
};

export const useSaveKeyDraft = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.saveKeyDraft.mutationOptions({
      onSuccess: (progress, input) => {
        queryClient.setQueryData(orpc.campanhas.connectProgress.queryKey({ input: { trackingId: input.trackingId } }), progress);
      },
    }),
  );
};
