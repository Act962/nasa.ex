import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface UseLeadActionProps {
  leadId: string;
  // Permite fetch condicional — ex.: só buscar quando o popover abre.
  enabled?: boolean;
}

export function useQueryLeadAction({
  leadId,
  enabled = true,
}: UseLeadActionProps) {
  const { data, isLoading } = useQuery(
    orpc.leads.listActions.queryOptions({
      input: { leadId },
      enabled: enabled && !!leadId,
    }),
  );
  return { data, isLoading };
}

export function useMutationCreateLeadAction() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.leads.createAction.mutationOptions({
      onSuccess: (data) => {
        const leadId = data.action.leadId ?? "";

        queryClient.invalidateQueries({
          queryKey: orpc.leads.listActions.queryKey({
            input: { leadId },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.leads.get.queryKey({
            input: { id: leadId },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.leads.listHistoric.queryKey({
            input: { leadId },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.leads.list.queryKey(),
        });

        // Feed do Kanban — atualiza o badge de atividades no card do lead.
        // O board usa uma queryKey manual (`["leads.listLeadsByStatus", ...]`),
        // não a gerada pelo oRPC — invalidar pela string é o que casa.
        queryClient.invalidateQueries({
          queryKey: ["leads.listLeadsByStatus"],
        });

        toast.success(`Ação criada com sucesso`);
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao criar ação");
      },
    }),
  );
}

interface UseMutationUpdateLeadActionProps {
  leadId: string;
}

export function useMutationUpdateLeadAction({
  leadId,
}: UseMutationUpdateLeadActionProps) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.leads.updateActionByLead.mutationOptions({
      onSuccess: (data) => {
        const actualLeadId = data.action.leadId ?? leadId;

        queryClient.invalidateQueries({
          queryKey: orpc.leads.listActions.queryKey({
            input: { leadId: actualLeadId },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.leads.get.queryKey({
            input: { id: actualLeadId },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.leads.listHistoric.queryKey({
            input: { leadId: actualLeadId },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.leads.list.queryKey(),
        });

        // Feed do Kanban — atualiza o badge de atividades no card do lead.
        // O board usa uma queryKey manual (`["leads.listLeadsByStatus", ...]`),
        // não a gerada pelo oRPC — invalidar pela string é o que casa.
        queryClient.invalidateQueries({
          queryKey: ["leads.listLeadsByStatus"],
        });

        toast.success(`Ação atualizada com sucesso`);
      },
      onError: () => {
        toast.error(`Erro ao atualizar ação`);
      },
    }),
  );
}
