import { z } from "zod";

export const createTagSchema = z.object({
  trackingId: z.string().optional(),
});

export type CreateTagSchema = z.infer<typeof createTagSchema>;
