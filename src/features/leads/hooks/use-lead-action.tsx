import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface UseLeadActionProps {
  leadId: string;
}

export function useQueryLeadAction({ leadId }: UseLeadActionProps) {
  const { data, isLoading } = useQuery(
    orpc.leads.listActions.queryOptions({ input: { leadId } }),
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

        toast.success(`Ação criada com sucesso`);
      },
      onError: () => {
        toast.error(`Erro ao criar ação`);
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

        toast.success(`Ação atualizada com sucesso`);
      },
      onError: () => {
        toast.error(`Erro ao atualizar ação`);
      },
    }),
  );
}
