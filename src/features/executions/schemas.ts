import { z } from "zod";

export const leadContext = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string(),
  statusId: z.string(),
  trackingId: z.string(),
  responsibleId: z.string().nullable(),
  isActive: z.boolean(),
});

export type LeadContext = z.infer<typeof leadContext>;
