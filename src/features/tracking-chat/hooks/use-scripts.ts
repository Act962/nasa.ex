import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useScripts(trackingId: string) {
  return useQuery(
    orpc.scripts.list.queryOptions({
      input: { trackingId },
      enabled: !!trackingId,
    }),
  );
}

export function useCreateScript(trackingId: string) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.scripts.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.scripts.list.queryKey({ input: { trackingId } }),
        });
        toast.success("Script criado!");
      },
      onError: () => toast.error("Erro ao criar script"),
    }),
  );
}

export function useUpdateScript(trackingId: string) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.scripts.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.scripts.list.queryKey({ input: { trackingId } }),
        });
        toast.success("Script atualizado!");
      },
      onError: () => toast.error("Erro ao atualizar script"),
    }),
  );
}

export function useDeleteScript(trackingId: string) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.scripts.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.scripts.list.queryKey({ input: { trackingId } }),
        });
        toast.success("Script excluído!");
      },
      onError: () => toast.error("Erro ao excluir script"),
    }),
  );
}
