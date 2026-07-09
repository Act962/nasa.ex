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

/**
 * Origem do valor de uma variável `{{n}}` do template, resolvida por
 * destinatário no momento do disparo:
 *  - `static`        → texto fixo igual pra todos (`value`)
 *  - `recipientName` → nome do destinatário (fallback `value` se vazio)
 *  - `recipientPhone`→ telefone do destinatário
 *  - `customField`   → chave em `BroadcastRecipient.variables` (`value` = chave)
 */
export const broadcastTemplateParamSchema = z.object({
  source: z.enum(["static", "recipientName", "recipientPhone", "customField"]),
  value: z.string().default(""),
});
export type BroadcastTemplateParam = z.infer<typeof broadcastTemplateParamSchema>;

/** Mapa var→origem persistido em `Broadcast.templateVariables`. */
export const broadcastTemplateMappingSchema = z.object({
  header: z.array(broadcastTemplateParamSchema).default([]),
  body: z.array(broadcastTemplateParamSchema).default([]),
});
export type BroadcastTemplateMapping = z.infer<
  typeof broadcastTemplateMappingSchema
>;

export const setBroadcastTemplateSchema = z.object({
  broadcastId: z.string().min(1),
  templateName: z.string().min(1),
  templateLanguage: z.string().min(1),
  templateCategory: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  mapping: broadcastTemplateMappingSchema.default({ header: [], body: [] }),
});
export type SetBroadcastTemplateInput = z.infer<
  typeof setBroadcastTemplateSchema
>;

export const sendBroadcastSchema = z.object({
  broadcastId: z.string().min(1),
});
export type SendBroadcastInput = z.infer<typeof sendBroadcastSchema>;

export const reopenBroadcastSchema = z.object({
  broadcastId: z.string().min(1),
});
export type ReopenBroadcastInput = z.infer<typeof reopenBroadcastSchema>;

/**
 * Filtros da base unificada de contatos (Campanhas → Contatos). Cross-tracking:
 * `trackingId` é opcional (omitido = todos os trackings da org).
 */
export const contactFiltersSchema = z.object({
  trackingId: z.string().optional(),
  statusIds: z.array(z.string()).optional(),
  tagsFilter: z.array(z.string()).optional(),
  temperatureFilter: z
    .array(z.enum(["COLD", "WARM", "HOT", "VERY_HOT"]))
    .optional(),
  actionFilter: z.enum(["ACTIVE", "WON", "LOST"]).optional(),
  participantFilter: z.string().optional(),
  dateInit: z.string().optional(),
  dateEnd: z.string().optional(),
  search: z.string().trim().optional(),
});
export type ContactFiltersInput = z.infer<typeof contactFiltersSchema>;

export const listContactsSchema = contactFiltersSchema.extend({
  page: z.number().min(0).default(0),
  pageSize: z.number().min(1).max(100).default(30),
});
export type ListContactsInput = z.infer<typeof listContactsSchema>;

/**
 * Atrela contatos a uma campanha como destinatários. Ou uma seleção explícita
 * (`leadIds`) ou "todos os que casam com o filtro" (`allMatching`).
 */
export const addRecipientsFromContactsSchema = z
  .object({
    broadcastId: z.string().min(1),
    leadIds: z.array(z.string()).optional(),
    allMatching: contactFiltersSchema.optional(),
  })
  .refine(
    (value) => (value.leadIds && value.leadIds.length > 0) || value.allMatching,
    { message: "Selecione contatos ou use 'todos que casam com o filtro'." },
  );
export type AddRecipientsFromContactsInput = z.infer<
  typeof addRecipientsFromContactsSchema
>;
