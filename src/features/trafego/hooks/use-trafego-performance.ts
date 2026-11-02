import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import type { PerformanceBreakdown, PerformanceRange } from "@/features/trafego/lib/order-meta-metrics";

/** Desempenho pela conta de anúncios do cliente (spec 0122). O servidor guarda 15 min; o painel relê no mesmo ritmo. */

const REFETCH_INTERVAL_MS = 15 * 60 * 1000;

export const useTrafegoOrderBudget = (orderId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.trafego.performance.budget.queryOptions({ input: { orderId } }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
};

export const useTrafegoAccountOverview = (
  orderId: string,
  range: PerformanceRange,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    ...orpc.trafego.performance.overview.queryOptions({ input: { orderId, range } }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
};

export const useTrafegoOrderAds = (
  orderId: string,
  range: PerformanceRange,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    ...orpc.trafego.performance.ads.queryOptions({ input: { orderId, range } }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
};

export const useTrafegoAccountBreakdown = (
  orderId: string,
  range: PerformanceRange,
  breakdown: PerformanceBreakdown,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    ...orpc.trafego.performance.breakdown.queryOptions({ input: { orderId, range, breakdown } }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
  });
};

/** Taxa sobre o gasto real (spec 0123, RF-14). */
export const useTrafegoServiceFee = (orderId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.trafego.performance.serviceFee.queryOptions({ input: { orderId } }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
};

/** Complemento enviado e vencido trava criar e publicar campanha (spec 0123, RF-15). */
export const useTrafegoBillingLock = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.trafego.performance.billingLock.queryOptions({ input: {} }),
    enabled: options?.enabled ?? true,
  });
};
