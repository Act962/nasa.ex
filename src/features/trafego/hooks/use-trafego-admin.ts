import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TrafegoOrderStatus, TrafegoPlatform } from "@/generated/prisma/enums";

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

export const useTrafegoAdminOrder = (orderId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.trafego.admin.orders.get.queryOptions({ input: { orderId } }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
  });
};

function useAdminOrderInvalidation() {
  const queryClient = useQueryClient();
  return (orderId?: string) => {
    queryClient.invalidateQueries({ queryKey: orpc.trafego.admin.orders.list.key() });
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
    ...orpc.trafego.admin.orders.listMessages.queryOptions({ input: { orderId } }),
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
          queryKey: orpc.trafego.admin.orders.listMessages.key({ input: { orderId } }),
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
    queryClient.invalidateQueries({ queryKey: orpc.trafego.admin.plans.list.key() });
    queryClient.invalidateQueries({ queryKey: orpc.trafego.listPublicPlans.key() });
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
    orpc.trafego.admin.plans.toggleActive.mutationOptions({ onSuccess: invalidate }),
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
