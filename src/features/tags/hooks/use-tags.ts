import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useTags({
  trackingId,
  tagGroupId,
  includeArchived,
  onlyArchived,
}: {
  trackingId?: string;
  /** `null` explícito = "Sem categoria". `undefined` = sem filtro. */
  tagGroupId?: string | null;
  /** Inclui arquivadas (ativas + arquivadas). Default false. */
  includeArchived?: boolean;
  /** Só arquivadas (exclusivo). Default false. */
  onlyArchived?: boolean;
} = {}) {
  const { data, isLoading } = useQuery(
    orpc.tags.listTags.queryOptions({
      input: {
        query: {
          trackingId: trackingId === "ALL" ? undefined : trackingId,
          tagGroupId,
          includeArchived,
          onlyArchived,
        },
      },
    }),
  );

  return {
    tags: data?.tags || [],
    isLoadingTags: isLoading,
  };
}

/** Atalho: lista SÓ tags arquivadas — pra aba "Arquivadas" do TagSheet. */
export function useArchivedTags({ trackingId }: { trackingId?: string } = {}) {
  return useTags({ trackingId, onlyArchived: true });
}

/**
 * Invalida TODAS as variantes de `listTags` que importam pro UI de
 * arquivamento — sem trackingId (lista global), com trackingId
 * (lista do funil), com onlyArchived (aba "Arquivadas").
 *
 * Usar a queryKey plana `["tags"]` (que existia antes) NÃO casa com a
 * estrutura que o oRPC gera — por isso os botões Restaurar/Excluir
 * "não funcionavam" do ponto de vista do usuário: mutation rodava no
 * servidor mas a UI nunca atualizava.
 */
function invalidateAllTagLists(
  queryClient: ReturnType<typeof useQueryClient>,
  trackingId?: string | null,
) {
  const variants = [
    // Sem filtro de arquivamento
    { trackingId: trackingId ?? undefined },
    { trackingId: undefined },
    // Aba "Arquivadas"
    { trackingId: trackingId ?? undefined, onlyArchived: true },
    { trackingId: undefined, onlyArchived: true },
    // Inclui arquivadas (mistura)
    { trackingId: trackingId ?? undefined, includeArchived: true },
    { trackingId: undefined, includeArchived: true },
  ];
  for (const q of variants) {
    queryClient.invalidateQueries({
      queryKey: orpc.tags.listTags.queryKey({ input: { query: q } }),
    });
  }
}

/** Mutation pra restaurar tag arquivada (zera archivedAt). */
export function useRestoreTag() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.tags.updateTag.mutationOptions({
      onSuccess: (data) => {
        invalidateAllTagLists(queryClient, data.trackingId ?? undefined);
        toast.success(`Tag "${data.name}" restaurada`);
      },
      onError: (err) => {
        toast.error(`Erro ao restaurar tag: ${err.message}`);
      },
    }),
  );
}

/** Hard-delete admin (proc `tag.purge`). Tag deve estar arquivada antes. */
export function usePurgeTag() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.tags.purgeTag.mutationOptions({
      onSuccess: (data) => {
        invalidateAllTagLists(queryClient, data.trackingId ?? undefined);
        toast.success(`Tag "${data.name}" excluída permanentemente`);
      },
      onError: (err) => {
        toast.error(`Erro ao excluir tag: ${err.message}`);
      },
    }),
  );
}

/** Lista workflows ativos que referenciam uma tag específica. Usado no
 *  dialog de confirmação ao arquivar/editar uma tag com automationCount > 0. */
export function useReferencedWorkflows(tagId: string | null) {
  return useQuery({
    ...orpc.tags.getReferencedWorkflows.queryOptions({
      input: { tagId: tagId ?? "" },
    }),
    enabled: !!tagId,
  });
}

export function useQueryWithoutWidgetTags({
  organizationIds,
}: {
  organizationIds: string[];
}) {
  const { data, isLoading } = useQuery(
    orpc.tags.listTagsWithoutWidget.queryOptions({
      input: {
        organizationIds,
      },
    }),
  );

  return {
    tags: data?.tags || [],
    isLoadingTags: isLoading,
  };
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.tags.deleteTag.mutationOptions({
      onSuccess: (data) => {
        // Invalida a lista de tags global
        // Invalida a query específica do funil
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: { query: { trackingId: data.trackingId ?? undefined } },
          }),
        });

        // Invalida a query geral da organização (usada no dashboard)
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: { query: { trackingId: undefined } },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: ["conversations.list"],
        });

        queryClient.invalidateQueries({
          queryKey: ["leads", "get"],
        });
      },
    }),
  );
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.tags.updateTag.mutationOptions({
      onSuccess: (data) => {
        // Invalida a lista de tags global
        // Invalida a query específica do funil
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: { query: { trackingId: data.trackingId ?? undefined } },
          }),
        });

        // Invalida a query geral da organização (usada no dashboard)
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: { query: { trackingId: undefined } },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: ["conversations.list"],
        });

        queryClient.invalidateQueries({
          queryKey: ["leads", "get"],
        });
      },
    }),
  );
}

export function useMutationWhatsappTags({
  trackingId,
}: {
  trackingId?: string;
}) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.leads.updateWhatsappTags.mutationOptions({
      onSuccess: () => {
        // Invalida a lista de tags global
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: {
              query: {
                trackingId,
              },
            },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: ["conversations.list"],
        });

        queryClient.invalidateQueries({
          queryKey: ["leads", "get"],
        });
      },
    }),
  );
}
