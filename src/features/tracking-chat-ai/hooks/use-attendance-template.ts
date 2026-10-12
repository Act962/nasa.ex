import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Cria o modelo de atendimento por menu no funil (spec 0097) e atualiza a lista de fluxos e de menus. */
export const useCreateAttendanceTemplate = (trackingId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.ia.attendanceTemplate.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.workflow.key() });
        queryClient.invalidateQueries(orpc.ia.buttonPresets.list.queryOptions({ input: { trackingId } }));
      },
    }),
  );
};
