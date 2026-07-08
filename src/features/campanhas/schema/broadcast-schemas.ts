import { z } from "zod";

/**
 * Schemas Zod do app de Campanhas (disparos WhatsApp API Oficial).
 * Compartilhados entre as procedures oRPC (`src/app/router/campanhas/`) e os
 * hooks/componentes da feature. Ver `docs/campanhas-overview.md`.
 */

export const createBroadcastSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome").max(120),
  trackingId: z.string().min(1),
});
export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>;

export const updateBroadcastSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
});
export type UpdateBroadcastInput = z.infer<typeof updateBroadcastSchema>;

/**
 * Vocabulário de filtros de audiência — espelha `leads.listLeadsByStatus`.
 * Todos opcionais: sem filtro = todos os leads ativos do tracking de origem.
 */
export const audienceFilterSchema = z.object({
  statusIds: z.array(z.string()).optional(),
  tagsFilter: z.array(z.string()).optional(),
  temperatureFilter: z
    .array(z.enum(["COLD", "WARM", "HOT", "VERY_HOT"]))
    .optional(),
  actionFilter: z.enum(["ACTIVE", "WON", "LOST", "DELETED"]).optional(),
  participantFilter: z.string().optional(),
  projectsFilter: z.array(z.string()).optional(),
});
export type AudienceFilter = z.infer<typeof audienceFilterSchema>;

export const addRecipientsFromLeadsSchema = z.object({
  broadcastId: z.string().min(1),
  filters: audienceFilterSchema.default({}),
});
export type AddRecipientsFromLeadsInput = z.infer<
  typeof addRecipientsFromLeadsSchema
>;

/** Uma linha de CSV/XLSX já parseada no client. */
export const csvRecipientRowSchema = z.object({
  name: z.string().trim().optional(),
  phone: z.string().min(1),
  variables: z.record(z.string(), z.string()).optional(),
});
export type CsvRecipientRow = z.infer<typeof csvRecipientRowSchema>;

export const addRecipientsFromCsvSchema = z.object({
  broadcastId: z.string().min(1),
  rows: z.array(csvRecipientRowSchema).min(1).max(5000),
});
export type AddRecipientsFromCsvInput = z.infer<
  typeof addRecipientsFromCsvSchema
>;

export const recipientStatusSchema = z.enum([
  "PENDING",
  "QUEUED",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "SKIPPED",
]);

export const listRecipientsSchema = z.object({
  broadcastId: z.string().min(1),
  status: recipientStatusSchema.optional(),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
});
export type ListRecipientsInput = z.infer<typeof listRecipientsSchema>;

export const removeRecipientSchema = z.object({
  broadcastId: z.string().min(1),
  recipientId: z.string().min(1),
});
export type RemoveRecipientInput = z.infer<typeof removeRecipientSchema>;
