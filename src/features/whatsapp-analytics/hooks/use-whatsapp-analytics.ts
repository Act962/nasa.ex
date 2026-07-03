"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

interface UseWhatsAppAnalyticsInput {
  trackingId: string;
  startDate: string;
  endDate: string;
}

export const useWhatsAppAnalytics = (input: UseWhatsAppAnalyticsInput) => {
  const { data, ...query } = useQuery(
    orpc.whatsappAnalytics.getWhatsAppAnalytics.queryOptions({
      input,
      enabled: Boolean(input.trackingId && input.startDate && input.endDate),
    }),
  );

  return { report: data, ...query };
};
