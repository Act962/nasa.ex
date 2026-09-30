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
  "payment",
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
  "financeiro",
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
  financeiro: "Financeiro",
};

// ─── Audience shapes ─────────────────────────────────────────────────────────
// Cada AlertRule resolve audiência em runtime; o catálogo só restringe quais
// shapes fazem sentido por evento.

export const AUDIENCE_KINDS = [
  "lead_responsible",
  // Responsável do lead; sem responsável, owner/admin (spec 0029, CB-1).
  "lead_responsible_or_admins",
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
  /**
   * Params que o detector já aplicou como limiar. O motor não os compara com o
   * payload — senão "5 min" só casaria com uma espera de exatamente 5 min.
   */
  detectorOnlyParams?: readonly string[];
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

// ─── ASTRO: alertas proativos (spec 0029) ────────────────────────────────────

/** Janela em que novas mensagens da mesma conversa contam como a mesma chamada. */
const LEAD_CALLING_WINDOW_MS = 30 * 60 * 1000;

const chatLeadCalling: AlertEventDefinition = {
  key: "chat.lead_calling",
  label: "Lead chamando",
  description: "Um lead mandou mensagem e está esperando alguém.",
  category: "chat",
  appKey: "chat",
  paramsSchema: z.object({}),
  payloadSchema: z.object({
    conversationId: z.string(),
    leadId: z.string(),
    leadName: z.string().optional(),
    responsibleId: z.string().nullable().optional(),
    isQuestion: z.boolean().optional(),
    messagePreview: z.string().optional(),
    actionUrl: z.string().optional(),
    orgId: z.string(),
  }),
  audienceOptions: ["lead_responsible_or_admins", "lead_responsible", "org_admins", "whole_org"],
  supportsCooldown: true,
  // Várias mensagens seguidas são uma chamada só, não uma por mensagem.
  entityKey: (p) => {
    const bucket = Math.floor(Date.now() / LEAD_CALLING_WINDOW_MS);
    return `lead-calling:${(p as { conversationId: string }).conversationId}:${bucket}`;
  },
  mockPayload: {
    conversationId: "mock_conv",
    leadId: "mock_lead",
    leadName: "Maria",
    orgId: "mock_org",
  },
};

const chatLeadWaiting: AlertEventDefinition = {
  key: "chat.lead_waiting",
  label: "Lead esperando resposta",
  description: "Um lead está há alguns minutos sem resposta.",
  category: "chat",
  appKey: "chat",
  paramsSchema: z.object({
    waitingMinutes: z.number().int().min(1).max(240).default(5),
  }),
  payloadSchema: z.object({
    conversationId: z.string(),
    leadId: z.string(),
    leadName: z.string().optional(),
    responsibleId: z.string().nullable().optional(),
    waitingMinutes: z.number(),
    /** Início da espera — uma espera nova gera um alerta novo (CA-2). */
    waitingSince: z.string(),
    actionUrl: z.string().optional(),
    orgId: z.string(),
  }),
  audienceOptions: ["lead_responsible_or_admins", "lead_responsible", "org_admins", "whole_org"],
  supportsCooldown: true,
  entityKey: (p) => {
    const payload = p as { conversationId: string; waitingSince: string };
    return `lead-waiting:${payload.conversationId}:${payload.waitingSince}`;
  },
  detectorOnlyParams: ["waitingMinutes"],
  mockPayload: {
    conversationId: "mock_conv",
    leadId: "mock_lead",
    leadName: "Maria",
    waitingMinutes: 5,
    waitingSince: "2026-01-01T12:00:00.000Z",
    orgId: "mock_org",
  },
};

const paymentExpenseDueToday: AlertEventDefinition = {
  key: "payment.expense_due_today",
  label: "Despesa vence hoje",
  description: "Uma conta a pagar vence hoje e ainda não foi paga.",
  category: "payment",
  appKey: "financeiro",
  paramsSchema: z.object({}),
  payloadSchema: z.object({
    entryId: z.string(),
    entryTitle: z.string(),
    amount: z.number().optional(),
    /** 08:00 ou 15:00 — cada janela alerta uma vez (RF-5). */
    slot: z.string(),
    actionUrl: z.string().optional(),
    orgId: z.string(),
  }),
  // Financeiro só para quem enxerga financeiro (RF-8).
  audienceOptions: ["org_admins"],
  supportsCooldown: false,
  entityKey: (p) => {
    const payload = p as { entryId: string; slot: string };
    return `expense-due:${payload.entryId}:${payload.slot}`;
  },
  mockPayload: {
    entryId: "mock_entry",
    entryTitle: "Energia",
    amount: 480.9,
    slot: "2026-01-01:08",
    orgId: "mock_org",
  },
};

const forgeContractExpiring: AlertEventDefinition = {
  key: "forge.contract_expiring",
  label: "Contrato vencendo",
  description: "Um contrato ou proposta está perto do vencimento.",
  category: "forge",
  appKey: "forge",
  paramsSchema: z.object({
    daysBefore: z.number().int().min(0).max(60).default(7),
  }),
  payloadSchema: z.object({
    kind: z.enum(["contract", "proposal"]),
    entityId: z.string(),
    contractTitle: z.string(),
    daysLeft: z.number(),
    actionUrl: z.string().optional(),
    orgId: z.string(),
  }),
  audienceOptions: ["org_admins"],
  supportsCooldown: false,
  // Um alerta por dia por contrato até o vencimento (CA-4).
  entityKey: (p) => {
    const payload = p as { kind: string; entityId: string };
    const today = new Date().toISOString().slice(0, 10);
    return `contract-expiring:${payload.kind}:${payload.entityId}:${today}`;
  },
  mockPayload: {
    kind: "contract",
    entityId: "mock_contract",
    contractTitle: "Contrato de manutenção",
    daysLeft: 3,
    orgId: "mock_org",
  },
};

// ─── Aba Contábil (spec 0051, RF-16) ─────────────────────────────────────────
// Detectados pelo cron `detect-compliance-due`. O payload carrega `entityKey`
// porque o detector usa a notificação já gravada como trava de "rodou hoje".

const complianceBasePayload = {
  label: z.string(),
  entityKey: z.string().optional(),
  actionUrl: z.string().optional(),
  orgId: z.string(),
};

const accountingObligationDueSoon: AlertEventDefinition = {
  key: "accounting.obligation_due_soon",
  label: "Prazo fiscal chegando",
  description: "Uma guia ou declaração vence em 5 dias, em 2 dias ou hoje.",
  category: "payment",
  appKey: "financeiro",
  paramsSchema: z.object({}),
  payloadSchema: z.object({
    ...complianceBasePayload,
    obligationId: z.string(),
    kind: z.string(),
    period: z.string(),
    dueDate: z.string(),
    daysBefore: z.number().int(),
    amountCents: z.number().int().nullable().optional(),
  }),
  audienceOptions: ["org_admins"],
  supportsCooldown: false,
  entityKey: (p) => {
    const payload = p as { obligationId: string; daysBefore: number };
    return `obligation-due:${payload.obligationId}:${payload.daysBefore}`;
  },
  mockPayload: {
    label: "DAS (Simples Nacional)",
    obligationId: "mock_obligation",
    kind: "DAS",
    period: "2026-09",
    dueDate: "2026-10-20",
    daysBefore: 2,
    amountCents: 123456,
    orgId: "mock_org",
  },
};

const accountingObligationOverdue: AlertEventDefinition = {
  key: "accounting.obligation_overdue",
  label: "Prazo fiscal vencido",
  description: "Uma guia ou declaração passou do vencimento e ainda não foi resolvida.",
  category: "payment",
  appKey: "financeiro",
  paramsSchema: z.object({}),
  payloadSchema: z.object({
    ...complianceBasePayload,
    obligationId: z.string(),
    kind: z.string(),
    period: z.string(),
    dueDate: z.string(),
    daysOverdue: z.number().int(),
    /** Dia (AAAA-MM-DD, São Paulo) do aviso: um por dia, no máximo 3 dias. */
    dayKey: z.string(),
    amountCents: z.number().int().nullable().optional(),
  }),
  audienceOptions: ["org_admins"],
  supportsCooldown: false,
  entityKey: (p) => {
    const payload = p as { obligationId: string; dayKey: string };
    return `obligation-overdue:${payload.obligationId}:${payload.dayKey}`;
  },
  mockPayload: {
    label: "DAS (Simples Nacional)",
    obligationId: "mock_obligation",
    kind: "DAS",
    period: "2026-08",
    dueDate: "2026-09-19",
    daysOverdue: 1,
    dayKey: "2026-09-20",
    amountCents: 123456,
    orgId: "mock_org",
  },
};

const accountingAssessmentReady: AlertEventDefinition = {
  key: "accounting.assessment_ready",
  label: "Imposto do mês para conferir",
  description: "A apuração do mês passado ainda não foi confirmada e a guia não foi gerada.",
  category: "payment",
  appKey: "financeiro",
  paramsSchema: z.object({}),
  payloadSchema: z.object({
    ...complianceBasePayload,
    period: z.string(),
    dueDate: z.string().optional(),
    amountCents: z.number().int().nullable().optional(),
  }),
  audienceOptions: ["org_admins"],
  supportsCooldown: false,
  entityKey: (p) => {
    const payload = p as { orgId: string; period: string };
    return `assessment-ready:${payload.orgId}:${payload.period}`;
  },
  mockPayload: {
    label: "Apuração de 09/2026",
    period: "2026-09",
    amountCents: 98700,
    orgId: "mock_org",
  },
};

const accountingCreditMissingInvoice: AlertEventDefinition = {
  key: "accounting.credit_missing_invoice",
  label: "Despesas pagas sem nota",
  description: "Resumo semanal: despesas pagas sem nota anexada perdem o crédito de IBS/CBS.",
  category: "payment",
  appKey: "financeiro",
  paramsSchema: z.object({}),
  payloadSchema: z.object({
    ...complianceBasePayload,
    weekKey: z.string(),
    missingCount: z.number().int(),
    totalCents: z.number().int(),
  }),
  audienceOptions: ["org_admins"],
  supportsCooldown: false,
  entityKey: (p) => {
    const payload = p as { orgId: string; weekKey: string };
    return `credit-missing:${payload.orgId}:${payload.weekKey}`;
  },
  mockPayload: {
    label: "4 despesas pagas sem nota",
    weekKey: "2026-W40",
    missingCount: 4,
    totalCents: 250000,
    orgId: "mock_org",
  },
};

const accountingDocumentExpiring: AlertEventDefinition = {
  key: "accounting.document_expiring",
  label: "Documento da empresa vencendo",
  description: "Uma certidão, alvará ou certificado vence em 30, 15 ou 5 dias.",
  category: "payment",
  appKey: "financeiro",
  paramsSchema: z.object({}),
  payloadSchema: z.object({
    ...complianceBasePayload,
    typeCode: z.string(),
    documentId: z.string().nullable(),
    expiresAt: z.string(),
    daysBefore: z.number().int(),
  }),
  audienceOptions: ["org_admins"],
  supportsCooldown: false,
  entityKey: (p) => {
    const payload = p as { orgId: string; typeCode: string; documentId: string | null; daysBefore: number };
    return `document-expiring:${payload.documentId ?? `${payload.orgId}:${payload.typeCode}`}:${payload.daysBefore}`;
  },
  mockPayload: {
    label: "CND Federal",
    typeCode: "CND_FEDERAL",
    documentId: "mock_document",
    expiresAt: "2026-10-15",
    daysBefore: 15,
    orgId: "mock_org",
  },
};

const accountingDocumentExpired: AlertEventDefinition = {
  key: "accounting.document_expired",
  label: "Documento da empresa vencido",
  description: "Uma certidão, alvará ou certificado venceu. Pode travar licitação, nota ou crédito.",
  category: "payment",
  appKey: "financeiro",
  paramsSchema: z.object({}),
  payloadSchema: z.object({
    ...complianceBasePayload,
    typeCode: z.string(),
    documentId: z.string().nullable(),
    expiresAt: z.string(),
    blockingImpact: z.string().nullable().optional(),
  }),
  audienceOptions: ["org_admins"],
  supportsCooldown: false,
  // Um aviso por documento: quando ele for renovado, o documento novo tem outro id.
  entityKey: (p) => {
    const payload = p as { orgId: string; typeCode: string; documentId: string | null; expiresAt: string };
    return `document-expired:${payload.documentId ?? `${payload.orgId}:${payload.typeCode}`}:${payload.expiresAt}`;
  },
  mockPayload: {
    label: "CRF do FGTS",
    typeCode: "CRF_FGTS",
    documentId: "mock_document",
    expiresAt: "2026-09-20",
    blockingImpact: "Impede licitação.",
    orgId: "mock_org",
  },
};

const accountingRegularityScoreDropped: AlertEventDefinition = {
  key: "accounting.regularity_score_dropped",
  label: "Score de regularidade caiu",
  description: "O score de regularidade da empresa caiu 5 pontos ou mais em relação à semana passada.",
  category: "payment",
  appKey: "financeiro",
  paramsSchema: z.object({}),
  payloadSchema: z.object({
    ...complianceBasePayload,
    weekKey: z.string(),
    previousScoreBps: z.number().int(),
    currentScoreBps: z.number().int(),
  }),
  audienceOptions: ["org_admins"],
  supportsCooldown: false,
  entityKey: (p) => {
    const payload = p as { orgId: string; weekKey: string };
    return `score-dropped:${payload.orgId}:${payload.weekKey}`;
  },
  mockPayload: {
    label: "Score de regularidade",
    weekKey: "2026-W40",
    previousScoreBps: 9200,
    currentScoreBps: 8100,
    orgId: "mock_org",
  },
};

export const ALERT_CATALOG = [
  leadStatusChanged,
  leadTagAdded,
  leadStale,
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
  chatLeadCalling,
  chatLeadWaiting,
  paymentExpenseDueToday,
  forgeContractExpiring,
  accountingObligationDueSoon,
  accountingObligationOverdue,
  accountingAssessmentReady,
  accountingCreditMissingInvoice,
  accountingDocumentExpiring,
  accountingDocumentExpired,
  accountingRegularityScoreDropped,
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
