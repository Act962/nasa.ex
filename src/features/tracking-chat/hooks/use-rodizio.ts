import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useMutationRodizio() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.rodizio.finishLead.mutationOptions({
      onSuccess: (data) => {
        if (data.lead?.conversation?.id) {
          queryClient.invalidateQueries({
            queryKey: ["conversations.list"],
          });
        }

        queryClient.invalidateQueries({
          queryKey: orpc.conversation.get.queryKey({
            input: {
              conversationId: data.lead
                ? data?.lead.conversation?.id! || ""
                : "",
            },
          }),
        });
      },
    }),
  );
}
