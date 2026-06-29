import { orpc } from "@/lib/orpc";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Hooks pro CRUD de TagGroups. Padrão: cada mutation invalida
 * `tagGroups.list` + `tags.listTags` (tag pode estar mudando de grupo).
 */

export const useTagGroups = () => {
  return useQuery({
    ...orpc.tagGroups.list.queryOptions({ input: undefined }),
    staleTime: 60 * 1000,
  });
};

export const useCreateTagGroup = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.tagGroups.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Grupo "${data.group.name}" criado`);
        qc.invalidateQueries({
          queryKey: orpc.tagGroups.list.queryKey({ input: undefined }),
        });
      },
      onError: (err) => toast.error(err.message),
    }),
  );
};

export const useUpdateTagGroup = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.tagGroups.update.mutationOptions({
      onSuccess: () => {
        toast.success("Grupo atualizado");
        qc.invalidateQueries({
          queryKey: orpc.tagGroups.list.queryKey({ input: undefined }),
        });
        // Tags do grupo podem ter mudado cor/visual — invalida listagem
        qc.invalidateQueries({ queryKey: ["tags"] });
      },
      onError: (err) => toast.error(err.message),
    }),
  );
};

export const useDeleteTagGroup = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.tagGroups.delete.mutationOptions({
      onSuccess: (data) => {
        if (data.orphanedTagCount > 0) {
          toast.success(
            `Grupo "${data.name}" excluído. ${data.orphanedTagCount} tag(s) movidas pra "Sem categoria".`,
          );
        } else {
          toast.success(`Grupo "${data.name}" excluído`);
        }
        qc.invalidateQueries({
          queryKey: orpc.tagGroups.list.queryKey({ input: undefined }),
        });
        qc.invalidateQueries({ queryKey: ["tags"] });
      },
      onError: (err) => toast.error(err.message),
    }),
  );
};

export const useReorderTagGroups = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.tagGroups.reorder.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: orpc.tagGroups.list.queryKey({ input: undefined }),
        });
      },
      onError: (err) => toast.error(`Erro ao reordenar: ${err.message}`),
    }),
  );
};
