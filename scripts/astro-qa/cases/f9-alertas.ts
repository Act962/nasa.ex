import prisma from "../../../src/lib/prisma";
import { StarTransactionType } from "../../../src/generated/prisma/client";
import { runLeadWaitingDetection } from "../../../src/features/alerts/lib/detectors/lead-waiting";
import { runExpensesDueTodayDetection } from "../../../src/features/alerts/lib/detectors/expenses-due-today";
import { runContractsExpiringDetection } from "../../../src/features/alerts/lib/detectors/contracts-expiring";
import { debitStars } from "../../../src/features/stars/lib/star-service";
import { buildAstroVoice, shouldSpeakAlert } from "../../../src/features/astro/lib/astro-voice-catalog";
import {
  AI_QUOTA_EXHAUSTED_EVENT,
  AI_TOKEN_USAGE_HIGH_EVENT,
  reportAiQuotaExhausted,
  runAiTokenUsageDetection,
} from "../../../src/features/alerts/lib/ai-token-alerts";
import { resolveOrgAdmins } from "../../../src/features/alerts/lib/audience-resolver";
import { reseedAll } from "./f3-other-verbs";
import { expectThat, type QaCase, type QaCaseContext } from "./types";

// Alertas proativos (docs/astro-bateria-de-testes.md, F9). Os detectores são
// os mesmos dos crons, rodados com escopo na org de QA: as regras globais não
// podem disparar para as orgs reais do banco compartilhado.

const inlineStep = { run: (_name: string, work: () => unknown) => work() } as never;

const F9_EVENT_TYPES = ["chat.lead_waiting", "payment.expense_due_today", "forge.contract_expiring", AI_QUOTA_EXHAUSTED_EVENT, AI_TOKEN_USAGE_HIGH_EVENT];

function scopeOf(context: QaCaseContext) {
  return { organizationId: context.qaOrg.organizationId };
}

function findAlerts(context: QaCaseContext, eventType: string, since: Date) {
  return prisma.adminNotification.findMany({
    where: { organizationId: context.qaOrg.organizationId, eventType, createdAt: { gte: since } },
    select: { targetId: true, title: true, body: true, severity: true, actionUrl: true, eventPayload: true },
  });
}

async function removeAlertsAndReseed(context: QaCaseContext): Promise<void> {
  await prisma.adminNotification.deleteMany({
    where: {
      organizationId: context.qaOrg.organizationId,
      createdAt: { gte: context.startedAt },
      OR: [{ eventType: { in: F9_EVENT_TYPES } }, { type: "STARS_ALERT" }],
    },
  });
  await reseedAll(context);
}

async function systemAdminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { isSystemAdmin: true, isActive: true }, select: { id: true } });
  return admins.map((admin) => admin.id).sort();
}

function sameSet(left: (string | null)[], right: string[]): boolean {
  const sortedLeft = [...new Set(left)].sort();
  return sortedLeft.length === right.length && sortedLeft.every((value, index) => value === right[index]);
}

const QUOTA_ERROR = { message: "You exceeded your current quota", error: { code: "insufficient_quota" } };

export const F9_CASES: QaCase[] = [
  {
    id: "F9-01",
    complexity: "N2",
    title: "Lead 5 min sem resposta gera um alerta ao responsável",
    run: async (context) => {
      const lead = await prisma.lead.findFirstOrThrow({
        where: { tracking: { organizationId: context.qaOrg.organizationId }, name: "Maria Clara" },
        select: { id: true, conversation: { select: { id: true } } },
      });
      expectThat(lead.conversation, "Maria Clara sem conversa na massa.");
      await prisma.lead.update({
        where: { id: lead.id },
        data: { responsibleId: context.qaOrg.sellerUserId, lastInboundAt: new Date(Date.now() - 6 * 60_000), lastOutboundAt: null },
      });
      const runStartedAt = new Date();
      await runLeadWaitingDetection(inlineStep, scopeOf(context));
      await runLeadWaitingDetection(inlineStep, scopeOf(context));
      const alerts = (await findAlerts(context, "chat.lead_waiting", runStartedAt)).filter(
        (alert) => (alert.eventPayload as { conversationId?: string } | null)?.conversationId === lead.conversation!.id,
      );
      expectThat(alerts.length === 1, `${alerts.length} alertas para a mesma espera (esperado 1).`);
      expectThat(alerts[0].targetId === context.qaOrg.sellerUserId, "O alerta não foi para o responsável do lead.");
      const voice = buildAstroVoice({ kind: "chat.lead_waiting", title: alerts[0].title, body: alerts[0].body, severity: alerts[0].severity, actionUrl: alerts[0].actionUrl, payload: alerts[0].eventPayload });
      expectThat(/Maria Clara/.test(voice.headline), `Balão do orb sem o lead: "${voice.headline}".`);
      expectThat(alerts[0].actionUrl === `/tracking-chat/${lead.conversation.id}`, `Card sem link para a conversa: ${alerts[0].actionUrl}.`);
    },
    cleanup: removeAlertsAndReseed,
  },
  {
    id: "F9-02",
    complexity: "N2",
    title: "Despesa vencendo hoje alerta o admin e não o Vendedor",
    run: async (context) => {
      const runStartedAt = new Date();
      await runExpensesDueTodayDetection(inlineStep, scopeOf(context));
      const alerts = (await findAlerts(context, "payment.expense_due_today", runStartedAt)).filter(
        (alert) => (alert.eventPayload as { entryTitle?: string } | null)?.entryTitle === "Conta de internet",
      );
      const targets = alerts.map((alert) => alert.targetId);
      expectThat(targets.includes(context.qaOrg.ownerUserId), `Admin não recebeu. Destinatários: ${targets.join(", ") || "nenhum"}.`);
      expectThat(!targets.includes(context.qaOrg.sellerUserId), "O Vendedor recebeu alerta financeiro.");
      const paidAlerts = (await findAlerts(context, "payment.expense_due_today", runStartedAt)).filter(
        (alert) => (alert.eventPayload as { entryTitle?: string } | null)?.entryTitle === "Energia",
      );
      expectThat(paidAlerts.length === 0, "Alertou uma conta já paga.");
    },
    cleanup: removeAlertsAndReseed,
  },
  {
    id: "F9-03",
    complexity: "N2",
    title: "Proposta com validade em 7 dias alerta o dono",
    run: async (context) => {
      const proposal = await prisma.forgeProposal.findFirstOrThrow({
        where: { organizationId: context.qaOrg.organizationId, status: "ENVIADA" },
        select: { id: true, responsibleId: true },
      });
      await prisma.forgeProposal.update({
        where: { id: proposal.id },
        data: { validUntil: new Date(Date.now() + 5 * 24 * 60 * 60_000) },
      });
      const runStartedAt = new Date();
      await runContractsExpiringDetection(inlineStep, scopeOf(context));
      const alerts = (await findAlerts(context, "forge.contract_expiring", runStartedAt)).filter(
        (alert) => (alert.eventPayload as { entityId?: string } | null)?.entityId === proposal.id,
      );
      expectThat(alerts.length > 0, "Nenhum alerta para a proposta perto da validade.");
      expectThat(
        alerts.some((alert) => alert.targetId === proposal.responsibleId),
        `O dono da proposta não recebeu. Destinatários: ${alerts.map((alert) => alert.targetId).join(", ")}.`,
      );
      const daysLeft = (alerts[0].eventPayload as { daysLeft?: number }).daysLeft;
      expectThat(daysLeft === 5, `Dias até a validade: ${daysLeft} (esperado 5).`);
    },
    cleanup: removeAlertsAndReseed,
  },
  {
    id: "F9-04",
    complexity: "N2",
    title: "Stars zerando alerta com o botão de recarga",
    run: async (context) => {
      const organizationId = context.qaOrg.organizationId;
      const original = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { starsBalance: true, starsBonusBalance: true, starsGraceStartedAt: true },
      });
      const runStartedAt = new Date();
      try {
        await prisma.organization.update({
          where: { id: organizationId },
          data: { starsBalance: 1, starsBonusBalance: 0, starsGraceStartedAt: null },
        });
        const debit = await debitStars(organizationId, 1, StarTransactionType.APP_CHARGE, "QA F9-04");
        expectThat(debit.success && debit.newBalance === 0, `Débito de teste falhou: ${JSON.stringify(debit)}`);
        const alert = await prisma.adminNotification.findFirst({
          where: { organizationId, type: "STARS_ALERT", createdAt: { gte: runStartedAt } },
          select: { title: true, body: true, severity: true },
        });
        expectThat(alert, "Stars zerou e nenhum alerta foi criado.");
        const voice = buildAstroVoice({ kind: "STARS_ALERT", title: alert.title, body: alert.body, severity: alert.severity });
        const recharge = voice.actions.find((action) => action.kind === "link" && /recarreg/i.test(action.label));
        expectThat(recharge, `Alerta sem botão de recarga: ${voice.actions.map((action) => action.label).join(", ")}.`);
      } finally {
        await prisma.starTransaction.deleteMany({ where: { organizationId, description: "QA F9-04", createdAt: { gte: runStartedAt } } });
        await prisma.organization.update({ where: { id: organizationId }, data: original });
      }
    },
    cleanup: removeAlertsAndReseed,
  },
  {
    id: "F9-05",
    complexity: "N1",
    title: "Voz ligada fala o urgente; desligada, só o balão",
    run: async () => {
      const urgent = buildAstroVoice({
        kind: "chat.lead_waiting",
        title: "Lead esperando resposta",
        body: "Um lead está há alguns minutos sem resposta.",
        severity: "warning",
        payload: { leadName: "Maria Clara", waitingMinutes: 6 },
      });
      const informative = buildAstroVoice({ kind: "qa.sem_template", title: "Relatório pronto", body: "O relatório semanal está pronto.", severity: "info" });
      expectThat(urgent.priority === "urgent" && urgent.speech.length > 0, `Lead esperando não é urgente: ${urgent.priority}.`);
      expectThat(shouldSpeakAlert("audio", urgent.priority), "Voz ligada e alerta urgente: não falou.");
      expectThat(!shouldSpeakAlert("text", urgent.priority), "Voz desligada e ainda assim falou.");
      expectThat(!shouldSpeakAlert("match", urgent.priority), "Modo padrão (responde como perguntou) falou um alerta.");
      expectThat(!shouldSpeakAlert("audio", informative.priority), "Alerta informativo foi falado.");
    },
  },
  {
    id: "F9-06",
    complexity: "N2",
    title: "Crédito da IA acabou (chave da plataforma): um alerta aos administradores do sistema",
    run: async (context) => {
      const organizationId = context.qaOrg.organizationId;
      const runStartedAt = new Date();
      await reportAiQuotaExhausted({ organizationId, usingCustomKey: false, source: "qa", error: { message: "Rate limit reached", statusCode: 429 } });
      expectThat((await findAlerts(context, AI_QUOTA_EXHAUSTED_EVENT, runStartedAt)).length === 0, "Limite de taxa virou alerta de crédito.");
      await reportAiQuotaExhausted({ organizationId, usingCustomKey: false, source: "qa", error: QUOTA_ERROR });
      await reportAiQuotaExhausted({ organizationId, usingCustomKey: false, source: "qa", error: QUOTA_ERROR });
      const alerts = await findAlerts(context, AI_QUOTA_EXHAUSTED_EVENT, runStartedAt);
      const expected = await systemAdminIds();
      expectThat(alerts.length === expected.length, `${alerts.length} alertas para ${expected.length} administrador(es) do sistema (repetiu?).`);
      expectThat(sameSet(alerts.map((alert) => alert.targetId), expected), "O alerta não foi para os administradores do sistema.");
      expectThat(alerts.every((alert) => alert.severity === "critical"), "Crédito esgotado não saiu como alerta crítico.");
    },
    cleanup: removeAlertsAndReseed,
  },
  {
    id: "F9-07",
    complexity: "N2",
    title: "Crédito da IA acabou (chave própria): alerta aos admins da org",
    run: async (context) => {
      const organizationId = context.qaOrg.organizationId;
      const runStartedAt = new Date();
      await reportAiQuotaExhausted({ organizationId, usingCustomKey: true, source: "qa", error: QUOTA_ERROR });
      const alerts = await findAlerts(context, AI_QUOTA_EXHAUSTED_EVENT, runStartedAt);
      const orgAdmins = (await resolveOrgAdmins(organizationId)).sort();
      expectThat(sameSet(alerts.map((alert) => alert.targetId), orgAdmins), `Destinatários ${alerts.map((alert) => alert.targetId).join(", ")} ≠ admins da org.`);
      expectThat(!alerts.some((alert) => alert.targetId === context.qaOrg.sellerUserId), "O Vendedor recebeu alerta de crédito.");
    },
    cleanup: removeAlertsAndReseed,
  },
  {
    id: "F9-08",
    complexity: "N2",
    title: "Consumo alto de tokens no dia: um aviso por dia",
    run: async (context) => {
      const organizationId = context.qaOrg.organizationId;
      await prisma.usageEvent.create({
        data: { organizationId, kind: "LLM", action: "astro_tokens", feature: "qa.f9-08", totalTokens: 50, usingCustomKey: false },
      });
      const previousLimit = process.env.AI_TOKEN_DAILY_ALERT_TOKENS;
      process.env.AI_TOKEN_DAILY_ALERT_TOKENS = "10";
      const runStartedAt = new Date();
      try {
        await runAiTokenUsageDetection({ organizationId });
        await runAiTokenUsageDetection({ organizationId });
      } finally {
        if (previousLimit === undefined) delete process.env.AI_TOKEN_DAILY_ALERT_TOKENS;
        else process.env.AI_TOKEN_DAILY_ALERT_TOKENS = previousLimit;
        await prisma.usageEvent.deleteMany({ where: { organizationId, feature: "qa.f9-08" } });
      }
      const alerts = await findAlerts(context, AI_TOKEN_USAGE_HIGH_EVENT, runStartedAt);
      const expected = await systemAdminIds();
      expectThat(alerts.length === expected.length, `${alerts.length} avisos (esperado ${expected.length}, um por administrador).`);
      expectThat(alerts.every((alert) => alert.severity === "warning"), "Consumo alto não saiu como aviso.");
    },
    cleanup: removeAlertsAndReseed,
  },
];
