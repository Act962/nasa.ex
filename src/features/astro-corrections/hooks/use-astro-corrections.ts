import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { CorrectionStatus } from "@/features/astro-corrections/lib/parse-correction";

export function useAstroCorrections(params: { status: CorrectionStatus; route?: string; page: number }) {
  return useQuery(
    orpc.admin.astroCorrections.list.queryOptions({
      input: { status: params.status, route: params.route, page: params.page },
    }),
  );
}

export function useUpdateAstroCorrectionStatus() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.admin.astroCorrections.updateStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.admin.astroCorrections.list.key() });
      },
    }),
  );
}
