import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Conversas com o ASTRO na aba Sessões (spec 0028, RF-10). */

export function useAstroSessions(take = 50) {
  const query = useQuery(orpc.astro.sessions.list.queryOptions({ input: { take } }));
  return {
    sessions: query.data?.sessions ?? [],
    isLoading: query.isLoading,
  };
}

export function useDeleteAstroSession() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.astro.sessions.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.astro.sessions.list.key() });
      },
    }),
  );
}
