import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Grava no Histórico as falas da chamada de voz (spec 0054, RF-4). */
export function useAppendAstroVoiceTurns() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.astro.sessions.appendVoiceTurns.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.astro.sessions.key() }),
    }),
  );
}
