import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Importa contatos de planilha CRIANDO leads num tracking/coluna (reusa
 * `leads.importLead`). Invalida a base de contatos das campanhas no sucesso.
 */
export const useImportContacts = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.leads.importLead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.campanhas.listContacts.key(),
        });
      },
    }),
  );
};
