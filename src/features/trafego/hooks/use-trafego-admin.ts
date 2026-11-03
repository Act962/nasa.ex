"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  TrafegoOrderStatus,
  TrafegoPlatform,
} from "@/generated/prisma/enums";

interface AdminOrdersFilter {
  status?: TrafegoOrderStatus;
  platform?: TrafegoPlatform;
  onlyMismatch?: boolean;
  search?: string;
  page?: number;
}

export const useTrafegoAdminOrders = (filter: AdminOrdersFilter = {}) => {
  return useQuery(
    orpc.trafego.admin.orders.list.queryOptions({
      input: { ...filter, page: filter.page ?? 1 },
    }),
  );
};

export const useTrafegoAdminOrder = (
  orderId: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    ...orpc.trafego.admin.orders.get.queryOptions({ input: { orderId } }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
  });
};

function useAdminOrderInvalidation() {
  const queryClient = useQueryClient();
  return (orderId?: string) => {
    queryClient.invalidateQueries({
      queryKey: orpc.trafego.admin.orders.list.key(),
    });
    if (orderId) {
      queryClient.invalidateQueries({
        queryKey: orpc.trafego.admin.orders.get.key({ input: { orderId } }),
      });
    }
  };
}

export const useUpdateTrafegoOrderStatus = () => {
  const invalidate = useAdminOrderInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.updateStatus.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useCreateManualTrafegoOrder = () => {
  const invalidate = useAdminOrderInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.createManual.mutationOptions({
      onSuccess: () => invalidate(),
    }),
  );
};

/** "Corrigir valores" antes de ir ao ar (spec 0122, RF-16). */
export const useCorrectTrafegoOrderValues = () => {
  const invalidate = useAdminOrderInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.correctValues.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

/** Lista de acessos marcada pela equipe no setup (spec 0126, RF-7). */
export const useUpdateTrafegoAccessChecklistAdmin = () => {
  const invalidate = useAdminOrderInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.updateAccessChecklist.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

/** Libera mais anúncios no ar depois de cobrar o extra (spec 0127, RF-6). */
export const useSetTrafegoRunningAdsLimit = () => {
  const invalidate = useAdminOrderInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.setRunningAdsLimit.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

/** Complementos da taxa pelo gasto real (spec 0123, RF-13). */
export const useTrafegoComplements = (orderId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.trafego.admin.orders.complements.list.queryOptions({ input: { orderId } }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
  });
};

function useComplementInvalidation() {
  const queryClient = useQueryClient();
  const invalidateOrder = useAdminOrderInvalidation();
  return (orderId: string) => {
    invalidateOrder(orderId);
    queryClient.invalidateQueries({
      queryKey: orpc.trafego.admin.orders.complements.list.key({ input: { orderId } }),
    });
  };
}

export const useSendTrafegoComplement = () => {
  const invalidate = useComplementInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.complements.send.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useCancelTrafegoComplement = () => {
  const invalidate = useComplementInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.complements.cancel.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useSetTrafegoOutsideCampaigns = () => {
  const invalidate = useComplementInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.setOutsideCampaigns.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useAssignTrafegoOrder = () => {
  const invalidate = useAdminOrderInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.assign.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useLinkTrafegoMetaCampaign = () => {
  const invalidate = useAdminOrderInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.linkMetaCampaign.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useUnlinkTrafegoMetaCampaign = () => {
  const invalidate = useAdminOrderInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.unlinkMetaCampaign.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useLinkTrafegoBroadcast = () => {
  const invalidate = useAdminOrderInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.linkBroadcast.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useReviewTrafegoCreative = (orderId: string) => {
  const invalidate = useAdminOrderInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.reviewCreative.mutationOptions({
      onSuccess: () => invalidate(orderId),
    }),
  );
};

export const useTrafegoAdminMessages = (
  orderId: string,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) => {
  return useQuery({
    ...orpc.trafego.admin.orders.listMessages.queryOptions({
      input: { orderId },
    }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
    refetchInterval: options?.refetchInterval,
  });
};

export const useReplyTrafegoMessage = (orderId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.trafego.admin.orders.reply.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.trafego.admin.orders.listMessages.key({
            input: { orderId },
          }),
        });
      },
    }),
  );
};

// ── Planos ──

export const useTrafegoAdminPlans = () => {
  return useQuery(orpc.trafego.admin.plans.list.queryOptions({ input: {} }));
};

function usePlansInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: orpc.trafego.admin.plans.list.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.trafego.listPublicPlans.key(),
    });
  };
}

export const useCreateTrafegoPlan = () => {
  const invalidate = usePlansInvalidation();
  return useMutation(
    orpc.trafego.admin.plans.create.mutationOptions({ onSuccess: invalidate }),
  );
};

export const useUpdateTrafegoPlan = () => {
  const invalidate = usePlansInvalidation();
  return useMutation(
    orpc.trafego.admin.plans.update.mutationOptions({ onSuccess: invalidate }),
  );
};

export const useToggleTrafegoPlanActive = () => {
  const invalidate = usePlansInvalidation();
  return useMutation(
    orpc.trafego.admin.plans.toggleActive.mutationOptions({
      onSuccess: invalidate,
    }),
  );
};

export const useDeleteTrafegoPlan = () => {
  const invalidate = usePlansInvalidation();
  return useMutation(
    orpc.trafego.admin.plans.delete.mutationOptions({ onSuccess: invalidate }),
  );
};

// ── Ajustes ──

export const useTrafegoSettings = () => {
  return useQuery(orpc.trafego.admin.settings.get.queryOptions({ input: {} }));
};

/** Organizações disponíveis para configurar a agência que opera o trafeGO. */
export const useTrafegoAgencyOrganizations = (search: string, limit = 50) => {
  return useQuery(
    orpc.admin.listOrganizationsForSelection.queryOptions({
      input: { search: search.trim() || undefined, limit },
    }),
  );
};

export const useUpdateTrafegoSettings = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.trafego.admin.settings.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.trafego.admin.settings.get.key(),
        });
      },
    }),
  );
};

/** Trackings (com colunas), contas, categorias e formulários da org da agência. */
export const useTrafegoAgencyOptions = (
  organizationId: string | null | undefined,
) => {
  const enabled = Boolean(organizationId?.trim());
  return useQuery({
    ...orpc.trafego.admin.settings.listAgencyOptions.queryOptions({
      input: { organizationId: organizationId?.trim() ?? "" },
    }),
    enabled,
  });
};

function useSettingsInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: orpc.trafego.admin.settings.get.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.trafego.admin.settings.listAgencyOptions.key(),
    });
  };
}

export const useProvisionTrafegoOperationsTracking = () => {
  const invalidate = useSettingsInvalidation();
  return useMutation(
    orpc.trafego.admin.settings.provisionOperationsTracking.mutationOptions({
      onSuccess: invalidate,
    }),
  );
};

export const useProvisionTrafegoBriefingForm = () => {
  const invalidate = useSettingsInvalidation();
  return useMutation(
    orpc.trafego.admin.settings.provisionBriefingForm.mutationOptions({
      onSuccess: invalidate,
    }),
  );
};

/** Prompt para a equipe colar no Claude e montar a campanha (spec 0130, RF-6). Sob demanda: gera link novo do criativo. */
export const useBuildTrafegoPublishPrompt = () =>
  useMutation(orpc.trafego.admin.orders.buildPublishPrompt.mutationOptions());

/** Aprovação à mão quando a rotina do Claude para (spec 0132, RF-9). */
export const useApproveTrafegoOrderReview = () => {
  const invalidate = useAdminOrderInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.approveReview.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

/** Marca como publicado depois de criar a campanha por fora (spec 0132, RF-9). */
export const useMarkTrafegoOrderPublished = () => {
  const invalidate = useAdminOrderInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.markPublished.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

/** Recomendação do Claude enviada ao cliente para aprovar (spec 0130, RF-7). */
export const useSendTrafegoRecommendation = () => {
  const invalidate = useAdminOrderInvalidation();
  return useMutation(
    orpc.trafego.admin.orders.sendForApproval.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};
