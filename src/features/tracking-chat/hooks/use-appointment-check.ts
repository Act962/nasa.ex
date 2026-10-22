import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// Cartão interno do agendamento no chat (spec 0113, RF-18).
export function useAnswerAppointmentCheck() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.conversation.answerAppointmentCheck.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.conversation.get.key() });
      },
    }),
  );
}
