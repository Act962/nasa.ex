import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useMutationRodizio(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.rodizio.finishLead.mutationOptions({
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries({
          queryKey: ["conversations.list"],
        });

        queryClient.invalidateQueries({
          queryKey: orpc.conversation.get.queryKey({
            input: { conversationId },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.leads.get.queryKey({
            input: { id: variables.leadId },
          }),
        });
      },
    }),
  );
}
