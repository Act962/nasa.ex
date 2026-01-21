import { orpc } from "@/lib/orpc";
import { getQueryClient } from "@/lib/query/hydration";
import { useMutation, useQuery } from "@tanstack/react-query";
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

export interface UseMutationCreateLeadActionProps {
  leadId: string;
}

export function useMutationCreateLeadAction({
  leadId,
}: UseMutationCreateLeadActionProps) {
  const queryClient = getQueryClient();

  return useMutation(
    orpc.leads.createAction.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.leads.listActions.queryKey({
            input: { leadId },
          }),
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
  const queryClient = getQueryClient();

  return useMutation(
    orpc.leads.updateActionByLead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.leads.listActions.queryKey({
            input: { leadId },
          }),
        });
        toast.success(`Ação atualizada com sucesso`);
      },
      onError: () => {
        toast.error(`Erro ao atualizar ação`);
      },
    }),
  );
}
