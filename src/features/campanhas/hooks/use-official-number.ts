import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Número oficial: compra Salvy, código SMS ao vivo e painel "Número e gastos" (spec 0040). */

export const useSalvyNumberOffer = (options?: { enabled?: boolean }) => {
  return useQuery({ ...orpc.campanhas.numberOffer.queryOptions(), enabled: options?.enabled ?? true });
};

export const useSalvyNumbers = () => {
  return useQuery(orpc.campanhas.listNumbers.queryOptions());
};

export const useBuySalvyNumber = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.buyNumber.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.listNumbers.key() });
      },
    }),
  );
};

export const useCancelSalvyNumber = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.cancelNumber.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.listNumbers.key() });
      },
    }),
  );
};

/** Polling do código SMS enquanto o assistente espera a verificação da Meta. */
export const useSalvyLatestCode = (numberId: string | null, options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.campanhas.latestNumberCode.queryOptions({ input: { numberId: numberId ?? "" } }),
    enabled: Boolean(numberId) && (options?.enabled ?? true),
    refetchInterval: 4_000,
  });
};

export const useMetaNumberPanel = (trackingId: string | null, options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.campanhas.numberPanel.queryOptions({ input: { trackingId: trackingId ?? "" } }),
    enabled: Boolean(trackingId) && (options?.enabled ?? true),
    staleTime: 5 * 60_000,
    retry: false,
  });
};

/** Cria o funil (tracking) onde chegam as respostas do número oficial — cliente novo ainda não tem nenhum. */
export const useCreateOfficialTracking = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.tracking.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.tracking.list.key() });
      },
    }),
  );
};

/** "Comprar número": cópia do pedido para a equipe. */
export const useNotifyNumberPurchaseInterest = () => {
  return useMutation(orpc.campanhas.notifyNumberPurchaseInterest.mutationOptions());
};

/** Custos do número no mês e o crédito da empresa (spec 0087, Parte F). */
export const useNumberCostSummary = (trackingId: string | null, month?: string) => {
  return useQuery({
    ...orpc.campanhas.numberCostSummary.queryOptions({ input: { trackingId: trackingId ?? "", month } }),
    enabled: Boolean(trackingId),
    placeholderData: (previousData) => previousData,
  });
};

export const useNumberCostEntries = (
  trackingId: string | null,
  filters: { month?: string; kind?: "call" | "meta" | "chat" | "number" },
) => {
  return useQuery({
    ...orpc.campanhas.numberCostEntries.queryOptions({ input: { trackingId: trackingId ?? "", ...filters } }),
    enabled: Boolean(trackingId),
    placeholderData: (previousData) => previousData,
  });
};
