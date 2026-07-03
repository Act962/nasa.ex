import { z } from "zod";

export const getWhatsAppAnalyticsInputSchema = z.object({
  trackingId: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export type GetWhatsAppAnalyticsInput = z.infer<
  typeof getWhatsAppAnalyticsInputSchema
>;
