import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Release e checklist de acessos do pedido.
 *
 * A geração roda no Inngest, então `generate` não devolve o texto — quem
 * mostra o resultado é o polling do `get` enquanto o rascunho não chega.
 */

export const useTrafegoRelease = (orderId: string, options?: { poll?: boolean }) => {
  return useQuery({
    ...orpc.trafego.release.get.queryOptions({ input: { orderId } }),
    enabled: Boolean(orderId),
    refetchInterval: options?.poll ? 4000 : false,
  });
};

function useReleaseInvalidation() {
  const queryClient = useQueryClient();
  return (orderId: string) => {
    queryClient.invalidateQueries({
      queryKey: orpc.trafego.release.get.key({ input: { orderId } }),
    });
  };
}

export const useAddTrafegoReleaseSource = () => {
  const invalidate = useReleaseInvalidation();
  return useMutation(
    orpc.trafego.release.addSource.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useRemoveTrafegoReleaseSource = () => {
  const invalidate = useReleaseInvalidation();
  return useMutation(
    orpc.trafego.release.removeSource.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useGenerateTrafegoRelease = () => {
  const invalidate = useReleaseInvalidation();
  return useMutation(
    orpc.trafego.release.generate.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useSaveTrafegoRelease = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.trafego.release.save.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: orpc.trafego.release.get.key({ input: { orderId: variables.orderId } }),
        });
        // Salvar o Release refaz as recomendações no servidor.
        queryClient.invalidateQueries({ queryKey: orpc.trafego.recommendations.get.key() });
      },
    }),
  );
};

export const useUpdateTrafegoAccessChecklist = () => {
  const invalidate = useReleaseInvalidation();
  return useMutation(
    orpc.trafego.accessChecklist.update.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};
