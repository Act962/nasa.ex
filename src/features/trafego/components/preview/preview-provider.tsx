"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { TrafegoBasePathProvider } from "@/features/trafego/lib/base-path";
import {
  PREVIEW_ORDER_ID,
  previewAdminOrderDetail,
  previewAdminOrders,
  previewMessages,
  previewOrderDetail,
  previewOrders,
  previewPerformance,
  previewRecommendations,
  previewRelease,
  previewSettings,
} from "@/features/trafego/lib/preview-fixtures";

/**
 * As fixtures cobrem o que as telas renderizam, não as ~60 colunas que as
 * procedures devolvem. Em vez de reescrever o fixture a cada coluna nova do
 * schema, injetamos com um cast — é dado de desenvolvimento, e o que garante
 * o contrato de verdade é o typecheck dos componentes, não deste arquivo.
 */
function seed(client: QueryClient, queryKey: readonly unknown[], data: unknown) {
  client.setQueryData(queryKey as never, data as never);
}

/**
 * Pré-popula o cache do TanStack Query com dados fictícios e desliga a rede.
 *
 * Assim os componentes REAIS do painel renderizam sem banco e sem login — o que
 * aparece na tela é o componente de produção, não uma cópia. Mexer no layout do
 * componente reflete aqui na hora.
 *
 * O `queryFn` que rejeita garante que nada saia para a rede: se um componente
 * pedir algo que não pré-populamos, ele cai no próprio estado de erro/vazio em
 * vez de travar num spinner eterno.
 */
export function TrafegoPreviewProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
          refetchOnMount: false,
          staleTime: Infinity,
          queryFn: async () => {
            throw new Error("preview: sem rede — dado não pré-populado");
          },
        },
        mutations: {
          retry: false,
          mutationFn: async () => {
            throw new Error(
              "Modo preview: as ações não gravam nada. Para testar o fluxo real é preciso banco.",
            );
          },
        },
      },
    });

    seed(client, orpc.trafego.listOrders.queryOptions({ input: {} }).queryKey, previewOrders);

    for (const order of previewOrders) {
      seed(
        client,
        orpc.trafego.getOrder.queryOptions({ input: { orderId: order.id } }).queryKey,
        order.id === PREVIEW_ORDER_ID
          ? previewOrderDetail
          : { ...previewOrderDetail, ...order, creatives: [], copies: [], events: [] },
      );

      client.setQueryData(
        orpc.trafego.getOrderPerformance.queryOptions({ input: { orderId: order.id, days: 30 } }).queryKey,
        order.hasMetricsLink
          ? previewPerformance
          : {
              platform: order.platform,
              status: order.status,
              hasMetrics: false,
              reason: "not_linked",
              source: "snapshot",
              autoLinked: false,
              period: { from: new Date(), to: new Date() },
              kpis: [],
              series: [],
              budget: {
                adBudgetBrlCents: order.adBudgetBrlCents,
                spentBrlCents: 0,
                remainingBrlCents: order.adBudgetBrlCents,
                percentUsed: 0,
              },
            },
      );

      client.setQueryData(
        orpc.trafego.support.list.queryOptions({ input: { orderId: order.id } }).queryKey,
        order.id === PREVIEW_ORDER_ID ? previewMessages : [],
      );

      seed(
        client,
        orpc.trafego.release.get.queryOptions({ input: { orderId: order.id } }).queryKey,
        previewRelease,
      );
      seed(
        client,
        orpc.trafego.recommendations.get.queryOptions({
          input: { orderId: order.id, refresh: false },
        }).queryKey,
        previewRecommendations,
      );
    }

    seed(
      client,
      orpc.trafego.admin.orders.list.queryOptions({ input: { page: 1 } }).queryKey,
      previewAdminOrders,
    );
    seed(
      client,
      orpc.trafego.admin.orders.get.queryOptions({ input: { orderId: PREVIEW_ORDER_ID } }).queryKey,
      previewAdminOrderDetail,
    );
    client.setQueryData(
      orpc.trafego.admin.orders.listMessages.queryOptions({ input: { orderId: PREVIEW_ORDER_ID } }).queryKey,
      previewMessages,
    );
    client.setQueryData(orpc.trafego.admin.settings.get.queryOptions({ input: {} }).queryKey, previewSettings);
    client.setQueryData(orpc.trafego.admin.plans.list.queryOptions({ input: {} }).queryKey, []);

    client.setQueryData(orpc.trafego.getPublicConfig.queryOptions({ input: {} }).queryKey, {
      supportWhatsapp: previewSettings.supportWhatsapp,
      pixAvailable: true,
      verification: { phone: true, whatsappCheck: true, social: true },
    });

    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      {/* Mantém a navegação dentro do preview em vez de cair no login. */}
      <TrafegoBasePathProvider value="/trafego/preview">
        {children}
      </TrafegoBasePathProvider>
    </QueryClientProvider>
  );
}
