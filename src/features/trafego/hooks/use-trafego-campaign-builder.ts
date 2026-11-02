"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Construtor de campanha de WhatsApp do painel (spec 0124). */

export const useCampaignBuilderAccess = (orderId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.trafego.campaignBuilder.access.queryOptions({ input: { orderId } }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
  });
};

export const useCampaignBuilderContext = (orderId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.trafego.campaignBuilder.context.queryOptions({ input: { orderId } }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
  });
};

export const useCampaignAudienceSuggestion = (orderId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.trafego.campaignBuilder.suggest.queryOptions({ input: { orderId } }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
    staleTime: 15 * 60 * 1000,
  });
};

export const useCampaignCitySearch = (orderId: string, query: string) => {
  return useQuery({
    ...orpc.trafego.campaignBuilder.searchCities.queryOptions({ input: { orderId, query } }),
    enabled: Boolean(orderId) && query.trim().length >= 2,
    staleTime: 15 * 60 * 1000,
  });
};

export const useCampaignInstagramPosts = (orderId: string, pageId: string | null) => {
  return useQuery({
    ...orpc.trafego.campaignBuilder.listInstagramPosts.queryOptions({ input: { orderId, pageId: pageId ?? "" } }),
    enabled: Boolean(orderId) && Boolean(pageId),
    staleTime: 5 * 60 * 1000,
  });
};

function useBuilderInvalidation() {
  const queryClient = useQueryClient();
  return (orderId: string) => {
    queryClient.invalidateQueries({ queryKey: orpc.trafego.campaignBuilder.context.key({ input: { orderId } }) });
    queryClient.invalidateQueries({ queryKey: orpc.trafego.getOrder.key() });
    queryClient.invalidateQueries({ queryKey: orpc.trafego.listOrders.key() });
  };
}

export const useCreateCampaignDraft = () => {
  const invalidate = useBuilderInvalidation();
  return useMutation(
    orpc.trafego.campaignBuilder.createDraft.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const usePublishCampaign = () => {
  const invalidate = useBuilderInvalidation();
  return useMutation(
    orpc.trafego.campaignBuilder.publish.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useDiscardCampaignDraft = () => {
  const invalidate = useBuilderInvalidation();
  return useMutation(
    orpc.trafego.campaignBuilder.discardDraft.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useUpdateOrderCampaign = () => {
  const invalidate = useBuilderInvalidation();
  return useMutation(
    orpc.trafego.campaignBuilder.update.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useReplaceCampaignAd = () => {
  const invalidate = useBuilderInvalidation();
  return useMutation(
    orpc.trafego.campaignBuilder.replaceAd.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

/** Liga e desliga conjunto ou anúncio no cartão do painel; relê os números do pedido. */
export const useSetCampaignDelivery = () => {
  const queryClient = useQueryClient();
  const invalidate = useBuilderInvalidation();
  return useMutation(
    orpc.trafego.campaignBuilder.setDelivery.mutationOptions({
      onSuccess: (_data, variables) => {
        invalidate(variables.orderId);
        queryClient.invalidateQueries({ queryKey: orpc.trafego.performance.key() });
      },
    }),
  );
};

/** O Astro sugere a correção do anúncio (spec 0128); não muda nada na Meta. */
export const useAnalyzeAdForFix = () => {
  return useMutation(orpc.trafego.campaignBuilder.analyzeAdForFix.mutationOptions());
};

/** Aplica a correção: troca o anúncio ou duplica pausado; relê os números do pedido. */
export const useApplyAdFix = () => {
  const queryClient = useQueryClient();
  const invalidate = useBuilderInvalidation();
  return useMutation(
    orpc.trafego.campaignBuilder.applyAdFix.mutationOptions({
      onSuccess: (_data, variables) => {
        invalidate(variables.orderId);
        queryClient.invalidateQueries({ queryKey: orpc.trafego.performance.key() });
      },
    }),
  );
};
