/**
 * Catálogo de eventos suportados pelo sistema de alertas.
 *
 * Cada entrada declara:
 *   - key: chave única usada em AlertRule.eventType e no event bus
 *   - label/description: pra UI (Astro Command, BellBell, settings futuras)
 *   - category: pra agrupar no picker
 *   - paramsSchema: Zod schema dos params configuráveis na regra
 *   - payloadSchema: Zod schema do payload que chega via eventBus
 *   - supportsCooldown: se cooldown faz sentido (evita spam de alerta)
 *   - mockPayload: usado pelo botão "Testar regra"
 *
 * Adicionar novo evento = adicionar entrada aqui + publicar do lugar certo.
 */

import { z } from "zod";

export const ALERT_CATEGORIES = [
  "lead",
  "form",
  "chat",
  "forge",
  "agenda",
  "integration",
  "metric",
  "broadcast",
  "action",
] as const;
export type AlertCategory = (typeof ALERT_CATEGORIES)[number];

// ─── App keys ────────────────────────────────────────────────────────────────
// `appKey` é mais user-friendly que `category` — corresponde 1:1 com o app
// que o user enxerga ("Tracking", "Workspace", etc), e é usado pra agrupar
// os eventos na tela `/settings/notifications` aba Automações.

export const APP_KEYS = [
  "tracking",
  "workspace",
  "agenda",
  "chat",
  "forge",
  "forms",
  "integracoes",
  "insights",
  "admin",
] as const;
export type AppKey = (typeof APP_KEYS)[number];

export const APP_LABELS: Record<AppKey, string> = {
  tracking: "Tracking",
  workspace: "Workspace",
  agenda: "Agenda",
  chat: "Chat",
  forge: "Forge",
  forms: "Formulários",
  integracoes: "Integrações",
  insights: "Insights",
  admin: "Admin",
};

// ─── Audience shapes ─────────────────────────────────────────────────────────
// Cada AlertRule resolve audiência em runtime; o catálogo só restringe quais
// shapes fazem sentido por evento.

export const AUDIENCE_KINDS = [
  "lead_responsible",
  "action_participants",
  "org_supervisors",
  "org_admins",
  "user",
  "whole_org",
] as const;
export type AudienceKind = (typeof AUDIENCE_KINDS)[number];

const audienceSchema = z.object({
  kind: z.enum(AUDIENCE_KINDS),
  userIds: z.array(z.string()).optional(),
});
export type Audience = z.infer<typeof audienceSchema>;

// ─── Definition ──────────────────────────────────────────────────────────────

export interface AlertEventDefinition<
  P extends z.ZodTypeAny = z.ZodTypeAny,
  E extends z.ZodTypeAny = z.ZodTypeAny,
> {
  key: string;
  label: string;
  description: string;
  category: AlertCategory;
  /**
   * App "público" do evento — usado pelas tabs do `/settings/notifications`
   * Automações pra agrupar. Pode ser inferido por categoria, mas explícito
   * permite eventos de uma categoria caírem em apps diferentes (ex:
   * `metric.below_threshold` é `insights`, não `admin`).
   */
  appKey: AppKey;
  paramsSchema: P;
  payloadSchema: E;
  audienceOptions: readonly AudienceKind[];
  supportsCooldown: boolean;
  /** Chave de dedupe construída a partir do payload. */
  entityKey: (payload: z.infer<E>) => string;
  /** Payload mockado pra botão "Testar regra". */
  mockPayload: z.infer<E>;
}

// ─── Eventos ─────────────────────────────────────────────────────────────────

// LEAD ───────────────────────────────────────
const leadStatusChanged: AlertEventDefinition = {
  key: "lead.status_changed",
  label: "Lead muda de status",
  description: "Dispara quando o card do lead é movido pra um status alvo.",
  category: "lead",
  appKey: "tracking",
  paramsSchema: z.object({
    statusId: z.string().min(1),
  }),
  payloadSchema: z.object({
    leadId: z.string(),
    fromStatusId: z.string().nullable(),
    toStatusId: z.string(),
    orgId: z.string(),
    responsibleId: z.string().nullable(),
  }),
  audienceOptions: ["lead_responsible", "org_supervisors", "org_admins", "user", "whole_org"],
  supportsCooldown: false,
  entityKey: (p) =>
    `lead-status:${(p as { leadId: string }).leadId}:${
      (p as { toStatusId: string }).toStatusId
    }`,
  mockPayload: {
    leadId: "mock_lead",
    fromStatusId: null,
    toStatusId: "mock_status",
    orgId: "mock_org",
    responsibleId: "mock_user",
  },
};

const leadTagAdded: AlertEventDefinition = {
  key: "lead.tag_added",
  label: "Lead recebe uma tag",
  description: "Dispara quando uma tag específica é adicionada ao lead.",
  category: "lead",
  appKey: "tracking",
  paramsSchema: z.object({
    tagId: z.string().min(1),
  }),
  payloadSchema: z.object({
    leadId: z.string(),
    tagId: z.string(),
    orgId: z.string(),
    responsibleId: z.string().nullable(),
  }),
  audienceOptions: ["lead_responsible", "org_supervisors", "org_admins", "user", "whole_org"],
  supportsCooldown: false,
  entityKey: (p) =>
    `lead-tag:${(p as { leadId: string }).leadId}:${(p as { tagId: string }).tagId}`,
  mockPayload: {
    leadId: "mock_lead",
    tagId: "mock_tag",
    orgId: "mock_org",
    responsibleId: "mock_user",
  },
};

const leadStale: AlertEventDefinition = {
  key: "lead.stale",
  label: "Lead sem contato há X dias",
  description:
    "Cron dispara pra leads ativos cujo lastInboundAt ultrapassou os dias configurados.",
  category: "lead",
  appKey: "tracking",
  paramsSchema: z.object({
    days: z.number().int().min(1).max(60),
  }),
  payloadSchema: z.object({
    leadId: z.string(),
    daysSilent: z.number(),
    orgId: z.string(),
    responsibleId: z.string().nullable(),
  }),
  audienceOptions: ["lead_responsible", "org_supervisors", "org_admins", "user", "whole_org"],
  supportsCooldown: true,
  entityKey: (p) => {
    const leadId = (p as { leadId: string }).leadId;
    const today = new Date().toISOString().slice(0, 10);
    return `lead-stale:${leadId}:${today}`;
  },
  mockPayload: {
    leadId: "mock_lead",
    daysSilent: 3,
    orgId: "mock_org",
    responsibleId: "mock_user",
  },
};

// FORM ───────────────────────────────────────
const formSubmitted: AlertEventDefinition = {
  key: "form.submitted",
  label: "Formulário preenchido",
  description: "Dispara assim que uma nova FormResponse é criada.",
  category: "form",
  appKey: "forms",
  paramsSchema: z.object({
    formId: z.string().optional(), // se omitido, dispara pra qualquer form
  }),
  payloadSchema: z.object({
    formId: z.string(),
    responseId: z.string(),
    leadId: z.string().nullable(),
    orgId: z.string(),
  }),
  audienceOptions: ["org_admins", "org_supervisors", "user", "whole_org"],
  supportsCooldown: false,
  entityKey: (p) => `form-sub:${(p as { responseId: string }).responseId}`,
  mockPayload: {
    formId: "mock_form",
    responseId: "mock_response",
    leadId: null,
    orgId: "mock_org",
  },
};

const formAbandoned: AlertEventDefinition = {
  key: "form.abandoned",
  label: "Formulário abandonado",
  description:
    "Cron dispara pra FormResponses iniciadas mas sem complete em N minutos.",
  category: "form",
  appKey: "forms",
  paramsSchema: z.object({
    minutes: z.number().int().min(5).max(1440),
  }),
  payloadSchema: z.object({
    formId: z.string(),
    responseId: z.string(),
    orgId: z.string(),
  }),
  audienceOptions: ["org_admins", "org_supervisors", "user", "whole_org"],
  supportsCooldown: true,
  entityKey: (p) => `form-abandon:${(p as { responseId: string }).responseId}`,
  mockPayload: {
    formId: "mock_form",
    responseId: "mock_response",
    orgId: "mock_org",
  },
};

// CHAT / SUPORTE ─────────────────────────────
const chatMessageReceived: AlertEventDefinition = {
  key: "chat.message_received",
  label: "Nova mensagem no suporte",
  description:
    "Dispara quando o suporte recebe uma mensagem inbound numa conversa.",
  category: "chat",
  appKey: "chat",
  paramsSchema: z.object({
    workspaceId: z.string().optional(),
  }),
  payloadSchema: z.object({
    conversationId: z.string(),
    messageId: z.string(),
    isInbound: z.boolean(),
    orgId: z.string(),
  }),
  audienceOptions: ["org_supervisors", "org_admins", "user", "whole_org"],
  supportsCooldown: true,
  entityKey: (p) => `chat-msg:${(p as { messageId: string }).messageId}`,
  mockPayload: {
    conversationId: "mock_conv",
    messageId: "mock_msg",
    isInbound: true,
    orgId: "mock_org",
  },
};

// FORGE ──────────────────────────────────────
const forgeProposalStatusChanged: AlertEventDefinition = {
  key: "forge.proposal_status_changed",
  label: "Proposta muda de status",
  description:
    "Toda transição de status do ForgeProposal — criada, enviada, visualizada, paga, expirada, cancelada.",
  category: "forge",
  appKey: "forge",
  paramsSchema: z.object({
    toStatus: z
      .enum([
        "RASCUNHO",
        "ENVIADA",
        "VISUALIZADA",
        "ACEITA",
        "PAGA",
        "EXPIRADA",
        "CANCELADA",
      ])
      .optional(),
  }),
  payloadSchema: z.object({
    proposalId: z.string(),
    fromStatus: z.string().nullable(),
    toStatus: z.string(),
    orgId: z.string(),
    leadId: z.string().nullable(),
    responsibleId: z.string().nullable(),
    amount: z.number().nullable(),
  }),
  audienceOptions: ["lead_responsible", "org_supervisors", "org_admins", "user", "whole_org"],
  supportsCooldown: false,
  entityKey: (p) =>
    `forge-prop:${(p as { proposalId: string }).proposalId}:${
      (p as { toStatus: string }).toStatus
    }`,
  mockPayload: {
    proposalId: "mock_proposal",
    fromStatus: "ENVIADA",
    toStatus: "PAGA",
    orgId: "mock_org",
    leadId: null,
    responsibleId: "mock_user",
    amount: 1000,
  },
};

// AGENDA ─────────────────────────────────────
const agendaStartingSoon: AlertEventDefinition = {
  key: "agenda.starting_soon",
  label: "Agenda começa em breve",
  description:
    "Cron dispara X minutos antes de cada agendamento começar.",
  category: "agenda",
  appKey: "agenda",
  paramsSchema: z.object({
    minutesBefore: z.number().int().min(1).max(1440),
  }),
  payloadSchema: z.object({
    appointmentId: z.string(),
    startsAt: z.string(), // ISO
    minutesUntil: z.number(),
    orgId: z.string(),
    participantUserIds: z.array(z.string()),
  }),
  audienceOptions: ["action_participants", "user", "whole_org"],
  supportsCooldown: false,
  entityKey: (p) =>
    `agenda-start:${(p as { appointmentId: string }).appointmentId}`,
  mockPayload: {
    appointmentId: "mock_appt",
    startsAt: new Date().toISOString(),
    minutesUntil: 15,
    orgId: "mock_org",
    participantUserIds: ["mock_user"],
  },
};

const agendaReminderFired: AlertEventDefinition = {
  key: "agenda.reminder_fired",
  label: "Lembrete de agenda disparou",
  description:
    "Dispara quando o cron check-reminders processa um Reminder.",
  category: "agenda",
  appKey: "agenda",
  paramsSchema: z.object({}),
  payloadSchema: z.object({
    actionId: z.string(),
    reminderId: z.string(),
    orgId: z.string(),
    participantUserIds: z.array(z.string()),
  }),
  audienceOptions: ["action_participants", "user", "whole_org"],
  supportsCooldown: false,
  entityKey: (p) =>
    `agenda-rem:${(p as { reminderId: string }).reminderId}`,
  mockPayload: {
    actionId: "mock_action",
    reminderId: "mock_reminder",
    orgId: "mock_org",
    participantUserIds: ["mock_user"],
  },
};

// INTEGRATION ────────────────────────────────
const integrationWhatsappDown: AlertEventDefinition = {
  key: "integration.whatsapp_down",
  label: "WhatsApp desconectado",
  description:
    "Cron detecta WhatsAppInstance.status=DISCONNECTED há mais de 1h.",
  category: "integration",
  appKey: "integracoes",
  paramsSchema: z.object({}),
  payloadSchema: z.object({
    instanceId: z.string(),
    orgId: z.string(),
    disconnectedSinceMinutes: z.number(),
  }),
  audienceOptions: ["org_admins", "org_supervisors", "user", "whole_org"],
  supportsCooldown: true,
  entityKey: (p) => {
    const today = new Date().toISOString().slice(0, 10);
    return `wa-down:${(p as { instanceId: string }).instanceId}:${today}`;
  },
  mockPayload: {
    instanceId: "mock_instance",
    orgId: "mock_org",
    disconnectedSinceMinutes: 60,
  },
};

const integrationMetaTokenExpired: AlertEventDefinition = {
  key: "integration.meta_token_expired",
  label: "Token Meta Ads expirou",
  description: "Token de PlatformIntegration meta perdeu validade.",
  category: "integration",
  appKey: "integracoes",
  paramsSchema: z.object({}),
  payloadSchema: z.object({
    integrationId: z.string(),
    orgId: z.string(),
  }),
  audienceOptions: ["org_admins", "org_supervisors", "user", "whole_org"],
  supportsCooldown: true,
  entityKey: (p) => {
    const today = new Date().toISOString().slice(0, 10);
    return `meta-exp:${(p as { integrationId: string }).integrationId}:${today}`;
  },
  mockPayload: {
    integrationId: "mock_integration",
    orgId: "mock_org",
  },
};

// METRIC ─────────────────────────────────────
const metricBelowThreshold: AlertEventDefinition = {
  key: "metric.below_threshold",
  label: "Métrica abaixo do limite",
  description:
    "Cron compara métricas (conversão, TTFR, saldo Stars, etc) vs threshold configurado.",
  category: "metric",
  appKey: "insights",
  paramsSchema: z.object({
    metric: z.enum([
      "conversion_rate",
      "ttfr_seconds",
      "stars_balance",
      "no_show_rate",
    ]),
    threshold: z.number(),
    windowDays: z.number().int().min(1).max(90).default(7),
  }),
  payloadSchema: z.object({
    orgId: z.string(),
    metric: z.string(),
    currentValue: z.number(),
    threshold: z.number(),
  }),
  audienceOptions: ["org_admins", "org_supervisors", "user", "whole_org"],
  supportsCooldown: true,
  entityKey: (p) => {
    const today = new Date().toISOString().slice(0, 10);
    return `metric:${(p as { orgId: string }).orgId}:${(p as { metric: string }).metric}:${today}`;
  },
  mockPayload: {
    orgId: "mock_org",
    metric: "conversion_rate",
    currentValue: 3.2,
    threshold: 5,
  },
};

// ACTION (Workspace) ─────────────────────────
const actionOverdue: AlertEventDefinition = {
  key: "action.overdue",
  label: "Ação vencida",
  description:
    "Cron detect-overdue publica quando uma Action está com dueDate passada e não concluída.",
  category: "action",
  appKey: "workspace",
  paramsSchema: z.object({
    // Convenção `min*`: filtra `payload.daysOverdue >= minDaysOverdue`.
    minDaysOverdue: z.number().int().min(1).max(60).optional(),
  }),
  payloadSchema: z.object({
    actionId: z.string(),
    userId: z.string(),
    orgId: z.string(),
    daysOverdue: z.number(),
  }),
  audienceOptions: ["user", "org_supervisors", "org_admins", "whole_org"],
  supportsCooldown: true,
  entityKey: (p) => {
    const today = new Date().toISOString().slice(0, 10);
    return `action-over:${(p as { actionId: string }).actionId}:${today}`;
  },
  mockPayload: {
    actionId: "mock_action",
    userId: "mock_user",
    orgId: "mock_org",
    daysOverdue: 2,
  },
};

// LEAD aguardando atendimento ───────────────
const leadWaitingAttention: AlertEventDefinition = {
  key: "lead.waiting_attention",
  label: "Lead aguardando atendimento",
  description:
    "Lead criado há mais de X minutos sem `firstResponseAt`. Cron varre a cada 5min.",
  category: "lead",
  appKey: "tracking",
  paramsSchema: z.object({
    minMinutes: z.number().int().min(5).max(1440).default(30),
  }),
  payloadSchema: z.object({
    leadId: z.string(),
    orgId: z.string(),
    minutesWaiting: z.number(),
    responsibleId: z.string().nullable(),
  }),
  audienceOptions: ["lead_responsible", "org_supervisors", "org_admins", "user", "whole_org"],
  supportsCooldown: true,
  entityKey: (p) => {
    const today = new Date().toISOString().slice(0, 10);
    return `lead-wait:${(p as { leadId: string }).leadId}:${today}`;
  },
  mockPayload: {
    leadId: "mock_lead",
    orgId: "mock_org",
    minutesWaiting: 35,
    responsibleId: "mock_user",
  },
};

// ACTION vencendo em breve ───────────────────
const actionDueSoon: AlertEventDefinition = {
  key: "action.due_soon",
  label: "Tarefa vencendo em breve",
  description:
    "Action com `dueDate` em menos de X horas e não concluída. Cron varre a cada 10min.",
  category: "action",
  appKey: "workspace",
  paramsSchema: z.object({
    hoursBefore: z.number().int().min(1).max(168).default(1),
  }),
  payloadSchema: z.object({
    actionId: z.string(),
    userId: z.string(),
    orgId: z.string(),
    minutesUntil: z.number(),
  }),
  audienceOptions: ["user", "action_participants", "org_supervisors", "org_admins", "whole_org"],
  supportsCooldown: true,
  entityKey: (p) => {
    const today = new Date().toISOString().slice(0, 10);
    return `action-soon:${(p as { actionId: string }).actionId}:${today}`;
  },
  mockPayload: {
    actionId: "mock_action",
    userId: "mock_user",
    orgId: "mock_org",
    minutesUntil: 45,
  },
};

// BROADCAST ──────────────────────────────────
const broadcastManual: AlertEventDefinition = {
  key: "broadcast.manual",
  label: "Mensagem manual do Master",
  description:
    "Disparada via painel de broadcast — não tem regra, vai direto pra audience escolhida.",
  category: "broadcast",
  appKey: "admin",
  paramsSchema: z.object({}),
  payloadSchema: z.object({
    title: z.string(),
    body: z.string(),
    orgId: z.string().nullable(),
    targetType: z.enum(["all", "org", "user"]),
    targetId: z.string().nullable(),
  }),
  audienceOptions: ["whole_org", "user"],
  supportsCooldown: false,
  entityKey: () => `broadcast:${crypto.randomUUID()}`,
  mockPayload: {
    title: "Mensagem de teste",
    body: "Esta é uma mensagem de broadcast.",
    orgId: null,
    targetType: "user",
    targetId: "mock_user",
  },
};

// ─── Export ──────────────────────────────────────────────────────────────────

export const ALERT_CATALOG = [
  leadStatusChanged,
  leadTagAdded,
  leadStale,
  leadWaitingAttention,
  formSubmitted,
  formAbandoned,
  chatMessageReceived,
  forgeProposalStatusChanged,
  agendaStartingSoon,
  agendaReminderFired,
  integrationWhatsappDown,
  integrationMetaTokenExpired,
  metricBelowThreshold,
  actionOverdue,
  actionDueSoon,
  broadcastManual,
] as const satisfies readonly AlertEventDefinition[];

export type AlertEventKey = (typeof ALERT_CATALOG)[number]["key"];

const byKey = new Map<string, AlertEventDefinition>(
  ALERT_CATALOG.map((d) => [d.key, d]),
);

export function getAlertEvent(
  key: string,
): AlertEventDefinition | undefined {
  return byKey.get(key);
}

export function getAlertEventsByCategory(
  category: AlertCategory,
): AlertEventDefinition[] {
  return ALERT_CATALOG.filter((d) => d.category === category);
}

export function getAlertEventsByAppKey(
  appKey: AppKey,
): AlertEventDefinition[] {
  return ALERT_CATALOG.filter((d) => d.appKey === appKey);
}

/**
 * Lista de apps que têm ao menos 1 evento no catálogo — usada pelas
 * tabs do `/settings/notifications` aba Automações. Mantém ordem
 * declarada em APP_KEYS (semantica: Tracking > Workspace > Agenda…).
 */
export function getActiveAppKeys(): AppKey[] {
  const present = new Set(ALERT_CATALOG.map((d) => d.appKey));
  return APP_KEYS.filter((k) => present.has(k));
}

export { audienceSchema };
