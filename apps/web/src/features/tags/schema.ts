import { z } from "zod";

export const createTagSchema = z.object({
  trackingId: z.string().optional(),
});

export type CreateTagSchema = z.infer<typeof createTagSchema>;

export const tagFormSchema = z.object({
  name: z.string().min(1, "Campo obrigatório"),
  color: z.string(),
  description: z.string().nullable().optional(),
});

export type TagFormSchema = z.infer<typeof tagFormSchema>;
