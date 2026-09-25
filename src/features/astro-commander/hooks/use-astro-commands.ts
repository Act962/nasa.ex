import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Hooks oRPC do ASTRO COMMANDER (spec 0023). Mutations já invalidam o cache do
 * domínio; toast e redirect ficam no componente.
 */

type CommandFilters = {
  search?: string;
  status?: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  persona?: "SALES" | "FINANCE" | "ADMIN" | "ACCOUNTING" | "CUSTOM";
};

function useInvalidateCommander() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["astroCommander"] });
    queryClient.invalidateQueries({
      queryKey: orpc.astroCommander.commands.list.queryKey(),
    });
  };
}

export function useAstroCommands(filters: CommandFilters = {}) {
  const query = useQuery(
    orpc.astroCommander.commands.list.queryOptions({ input: filters }),
  );
  return {
    commands: query.data?.commands ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useAstroCommand(id: string, enabled = true) {
  const query = useQuery({
    ...orpc.astroCommander.commands.get.queryOptions({ input: { id } }),
    enabled: enabled && Boolean(id),
  });
  return {
    command: query.data?.command ?? null,
    runsToday: query.data?.runsToday ?? 0,
    pendingApprovals: query.data?.pendingApprovals ?? 0,
    isLoading: query.isLoading,
  };
}

/** Interpreta a frase do usuário e devolve o rascunho para revisão. */
export function useDraftAstroCommand() {
  return useMutation(orpc.astroCommander.commands.draft.mutationOptions());
}

export function useCreateAstroCommand() {
  const invalidate = useInvalidateCommander();
  return useMutation(
    orpc.astroCommander.commands.create.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useUpdateAstroCommand() {
  const invalidate = useInvalidateCommander();
  return useMutation(
    orpc.astroCommander.commands.update.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useSetAstroCommandStatus() {
  const invalidate = useInvalidateCommander();
  return useMutation(
    orpc.astroCommander.commands.setStatus.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useRunAstroCommandNow() {
  const invalidate = useInvalidateCommander();
  return useMutation(
    orpc.astroCommander.commands.runNow.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useSetCommanderPaused() {
  const invalidate = useInvalidateCommander();
  return useMutation(
    orpc.astroCommander.commands.setOrgPaused.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}
