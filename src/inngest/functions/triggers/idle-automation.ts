import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { NonRetriableError } from "inngest";
import { sendText } from "@/http/uazapi/send-text";
import { persistOutboundMessage } from "@/features/tracking-chat-ai/lib/persist";
import { renderIdleTemplate } from "@/features/tracking-settings/lib/idle-template";
import type { IdleAutomationMessageMode } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Idle Automation — substitui o cron `detect-leads-waiting-attention` e o
 * workflow trigger `LAST_INBOUND_TIMEOUT` (ambos removidos).
 *
 * Padrão event-driven:
 *  1. Gatilho: `idle/lead-activity` — emitido pelo webhook (chat inbound) e
 *     pelos pontos de criação de lead (Astro + booking-agent), via
 *     `dispatchIdleActivityIfActive`, que só dispara se houver config ativa
 *     pro tracking. Resultado: 0 invocações em vão.
 *  2. Pra cada cenário ativo, agenda sub-evento com fireAt = now + minutes.
 *  3. Função de check faz step.sleepUntil, refetcha, re-valida (firstResponseAt
 *     null / lastOutboundAt antigo), e executa ações: ligar IA, mensagem,
 *     notificar responsável.
 *  4. cancelOn `idle/automation-disabled` mata runs em sleep imediatamente
 *     quando o usuário desliga o toggle.
 */

interface CheckEventData {
  leadId: string;
  trackingId: string;
  organizationId: string;
  conversationId: string | null;
  originalLastInboundAt: string | null;
  originalLastOutboundAt: string | null;
  fireAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// A) Scheduler — escuta os dois eventos de entrada e dispara checks
// ─────────────────────────────────────────────────────────────────────────

export const scheduleIdleChecks = inngest.createFunction(
  { id: "schedule-idle-checks", retries: 1 },
  // Listener exclusivo do evento dedicado. Os producers (webhook, astro,
  // booking-agent) só emitem esse evento quando há config ativa pro tracking
  // — então essa função NUNCA roda em vão. Step economizado no Free tier.
  { event: "idle/lead-activity" },
  async ({ event, step }) => {
    const data = event.data as {
      leadId?: string;
      trackingId?: string;
      organizationId?: string;
    };
    if (!data.leadId) throw new NonRetriableError("leadId required");

    // Sem step.run: Inngest serializa o retorno em JSON, perdendo o tipo
    // Date (vira string). Re-executar em retry é barato (reads idempotentes).
    const lead = await prisma.lead.findUnique({
      where: { id: data.leadId! },
      select: {
        id: true,
        trackingId: true,
        firstResponseAt: true,
        lastInboundAt: true,
        lastOutboundAt: true,
        isActive: true,
        statusFlow: true,
        tracking: { select: { organizationId: true } },
        conversation: { select: { id: true } },
      },
    });
    if (!lead) return { scheduled: 0, reason: "lead-deleted" };

    const config = await prisma.trackingIdleAutomation.findUnique({
      where: { trackingId: lead.trackingId },
    });
    const ctx = { lead, config };

    if (!ctx.config) return { scheduled: 0, reason: "no-config" };
    // Não bailamos em isActive=false: o toggle "Ligar IA" existe pra reativar
    // leads pausados (transfer_to_human / atendente assumiu). Bloquear aqui
    // contradiria o propósito da feature.
    if (ctx.lead.statusFlow === "FINISHED")
      return { scheduled: 0, reason: "lead-finished" };

    const toSend: { name: string; data: CheckEventData }[] = [];
    const now = Date.now();

    // Cenário 1: sem 1ª resposta
    if (
      ctx.config.noFirstRespActive &&
      ctx.lead.firstResponseAt === null
    ) {
      const fireAt = new Date(
        now + ctx.config.noFirstRespMinutes * 60_000,
      ).toISOString();
      toSend.push({
        name: "idle/check-no-first-response",
        data: {
          leadId: ctx.lead.id,
          trackingId: ctx.lead.trackingId,
          organizationId: ctx.lead.tracking.organizationId,
          conversationId: ctx.lead.conversation?.id ?? null,
          originalLastInboundAt:
            ctx.lead.lastInboundAt?.toISOString() ?? null,
          originalLastOutboundAt: null,
          fireAt,
        },
      });
    }

    // Cenário 2: em conversa, sem nova outbound do atendente
    if (
      ctx.config.inConvActive &&
      ctx.lead.firstResponseAt !== null
    ) {
      const fireAt = new Date(
        now + ctx.config.inConvMinutes * 60_000,
      ).toISOString();
      toSend.push({
        name: "idle/check-in-conv-idle",
        data: {
          leadId: ctx.lead.id,
          trackingId: ctx.lead.trackingId,
          organizationId: ctx.lead.tracking.organizationId,
          conversationId: ctx.lead.conversation?.id ?? null,
          originalLastInboundAt:
            ctx.lead.lastInboundAt?.toISOString() ?? null,
          originalLastOutboundAt:
            ctx.lead.lastOutboundAt?.toISOString() ?? null,
          fireAt,
        },
      });
    }

    if (toSend.length === 0) return { scheduled: 0 };

    await step.sendEvent("fan-out-idle-checks", toSend);
    return { scheduled: toSend.length };
  },
);

// ─────────────────────────────────────────────────────────────────────────
// B) Check sem 1ª resposta
// ─────────────────────────────────────────────────────────────────────────

export const checkNoFirstResponse = inngest.createFunction(
  {
    id: "check-no-first-response",
    retries: 0,
    // Cancela imediatamente se o usuário desativar o cenário no tracking
    // (sem esperar o sleepUntil terminar).
    cancelOn: [
      {
        event: "idle/automation-disabled",
        if: "async.data.trackingId == event.data.trackingId && event.data.scenario == 'noFirstResp'",
      },
    ],
  },
  { event: "idle/check-no-first-response" },
  async ({ event, step }) => {
    const data = event.data as CheckEventData;
    await step.sleepUntil("wait", new Date(data.fireAt));

    return await step.run("recheck-and-act", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: data.leadId },
        select: leadActionSelect,
      });
      if (!lead) return { cancelled: "lead-deleted" } as const;
      if (lead.firstResponseAt !== null)
        return { cancelled: "first-response-arrived" } as const;
      // isActive=false é OK: o toggle "Ligar IA" reativa o lead.
      if (lead.statusFlow === "FINISHED")
        return { cancelled: "lead-finished" } as const;

      const config = await prisma.trackingIdleAutomation.findUnique({
        where: { trackingId: lead.trackingId },
      });
      if (!config || !config.noFirstRespActive)
        return { cancelled: "config-disabled" } as const;

      await executeIdleActions({
        lead,
        scenario: "noFirstResp",
        config,
        minutesWaiting: config.noFirstRespMinutes,
      });

      return { fired: true, scenario: "noFirstResp" } as const;
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────
// C) Check em conversa
// ─────────────────────────────────────────────────────────────────────────

export const checkInConvIdle = inngest.createFunction(
  {
    id: "check-in-conv-idle",
    retries: 0,
    cancelOn: [
      {
        event: "idle/automation-disabled",
        if: "async.data.trackingId == event.data.trackingId && event.data.scenario == 'inConv'",
      },
    ],
  },
  { event: "idle/check-in-conv-idle" },
  async ({ event, step }) => {
    const data = event.data as CheckEventData;
    await step.sleepUntil("wait", new Date(data.fireAt));

    return await step.run("recheck-and-act", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: data.leadId },
        select: leadActionSelect,
      });
      if (!lead) return { cancelled: "lead-deleted" } as const;
      // isActive=false é OK: o toggle "Ligar IA" reativa o lead.
      if (lead.statusFlow === "FINISHED")
        return { cancelled: "lead-finished" } as const;

      // Se atendente respondeu desde o agendamento, abortar.
      const currentOutbound = lead.lastOutboundAt?.toISOString() ?? null;
      if (currentOutbound !== data.originalLastOutboundAt) {
        return { cancelled: "agent-responded" } as const;
      }

      const config = await prisma.trackingIdleAutomation.findUnique({
        where: { trackingId: lead.trackingId },
      });
      if (!config || !config.inConvActive)
        return { cancelled: "config-disabled" } as const;

      await executeIdleActions({
        lead,
        scenario: "inConv",
        config,
        minutesWaiting: config.inConvMinutes,
      });

      return { fired: true, scenario: "inConv" } as const;
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Helper: executa as ações configuradas
// ─────────────────────────────────────────────────────────────────────────

const leadActionSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  amount: true,
  trackingId: true,
  isActive: true,
  statusFlow: true,
  firstResponseAt: true,
  lastInboundAt: true,
  lastOutboundAt: true,
  responsibleId: true,
  responsible: {
    select: { id: true, name: true, email: true, phone: true },
  },
  conversation: { select: { id: true } },
  tracking: { select: { id: true, organizationId: true } },
} as const;

type LeadForActions = Prisma.LeadGetPayload<{
  select: typeof leadActionSelect;
}>;

interface ActionConfig {
  enableAi: boolean;
  messageMode: IdleAutomationMessageMode;
  message: string | null;
  notifyResp: boolean;
  respTemplate: string | null;
}

async function executeIdleActions(args: {
  lead: LeadForActions;
  scenario: "noFirstResp" | "inConv";
  config: {
    noFirstRespEnableAi: boolean;
    noFirstRespMessageMode: IdleAutomationMessageMode;
    noFirstRespMessage: string | null;
    noFirstRespNotifyResp: boolean;
    noFirstRespRespTemplate: string | null;
    inConvEnableAi: boolean;
    inConvMessageMode: IdleAutomationMessageMode;
    inConvMessage: string | null;
    inConvNotifyResp: boolean;
    inConvRespTemplate: string | null;
  };
  minutesWaiting: number;
}) {
  const { lead, scenario, config, minutesWaiting } = args;

  const c: ActionConfig =
    scenario === "noFirstResp"
      ? {
          enableAi: config.noFirstRespEnableAi,
          messageMode: config.noFirstRespMessageMode,
          message: config.noFirstRespMessage,
          notifyResp: config.noFirstRespNotifyResp,
          respTemplate: config.noFirstRespRespTemplate,
        }
      : {
          enableAi: config.inConvEnableAi,
          messageMode: config.inConvMessageMode,
          message: config.inConvMessage,
          notifyResp: config.inConvNotifyResp,
          respTemplate: config.inConvRespTemplate,
        };

  // 1. Ligar IA — despausar lead e disparar agente
  if (c.enableAi) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { isActive: true },
    });
    if (lead.conversation?.id) {
      await inngest.send({
        name: "chat/ai.whatsapp-message-received",
        data: {
          trackingId: lead.trackingId,
          leadId: lead.id,
          conversationId: lead.conversation.id,
          messageId: `idle-${scenario}-${Date.now()}`,
          organizationId: lead.tracking.organizationId,
          trigger: "idle-reopen",
        },
      });
    }
  }

  // 2. Enviar mensagem
  if (c.messageMode === "FIXED" && c.message && lead.phone) {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { trackingId: lead.trackingId },
      select: { apiKey: true, baseUrl: true, status: true },
    });
    if (instance && instance.status === "CONNECTED") {
      const rendered = renderIdleTemplate(c.message, {
        lead: {
          name: lead.name,
          phone: lead.phone,
          amount: lead.amount,
          email: lead.email,
        },
        minutesWaiting,
      });
      const res = await sendText(
        instance.apiKey,
        { number: lead.phone, text: rendered, delay: 0 },
        instance.baseUrl,
      );
      if (lead.conversation?.id) {
        await persistOutboundMessage({
          conversationId: lead.conversation.id,
          leadId: lead.id,
          trackingId: lead.trackingId,
          body: rendered,
          senderName: "Automação",
          externalMessageId: res.messageid,
        });
      }
    }
  } else if (c.messageMode === "AI_REOPEN" && lead.conversation?.id) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { isActive: true },
    });
    await inngest.send({
      name: "chat/ai.whatsapp-message-received",
      data: {
        trackingId: lead.trackingId,
        leadId: lead.id,
        conversationId: lead.conversation.id,
        messageId: `idle-reopen-${scenario}-${Date.now()}`,
        organizationId: lead.tracking.organizationId,
        trigger: "idle-reopen-with-instruction",
        idleMinutes: minutesWaiting,
      },
    });
  }

  // 3. Notificar responsável
  if (c.notifyResp && lead.responsibleId && c.respTemplate) {
    const rendered = renderIdleTemplate(c.respTemplate, {
      lead: {
        name: lead.name,
        phone: lead.phone,
        amount: lead.amount,
        email: lead.email,
      },
      minutesWaiting,
    });

    await prisma.adminNotification.create({
      data: {
        organizationId: lead.tracking.organizationId,
        targetType: "user",
        targetId: lead.responsibleId,
        createdBy: "SYSTEM",
        title: "Lead aguardando atenção",
        body: rendered,
        type: "warning",
        severity: "warning",
        displaySurface: "bell",
        requiresAck: false,
        eventType: `idle.${scenario}`,
        eventPayload: { leadId: lead.id, minutesWaiting } as never,
      },
    });
  }
}
