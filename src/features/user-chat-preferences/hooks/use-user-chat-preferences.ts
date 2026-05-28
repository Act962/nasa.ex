import { orpc } from "@/lib/orpc";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Hook pra ler preferências de chat do usuário logado. Devolve sempre
 * um objeto (com defaults quando nunca configurou) — nunca undefined,
 * facilitando uso em componentes sem branches de loading.
 */
export const useUserChatPreferences = () => {
  return useQuery({
    ...orpc.userChatPreferences.get.queryOptions({ input: undefined }),
    staleTime: 60 * 1000,
  });
};

/** Mutation pra atualizar preferências (upsert). Invalida `get` após sucesso. */
export const useUpdateUserChatPreferences = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.userChatPreferences.update.mutationOptions({
      onSuccess: () => {
        toast.success("Personalização do chat salva");
        qc.invalidateQueries({
          queryKey: orpc.userChatPreferences.get.queryKey({ input: undefined }),
        });
      },
      onError: (err) => {
        toast.error(`Erro ao salvar: ${err.message}`);
      },
    }),
  );
};
