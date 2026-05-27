/**
 * Pipeline unificado de "mensagem inbound chegou" — usado por:
 *  - Webhook uazapi (WhatsApp normal): `src/app/api/chat/webhook/route.ts`
 *  - In-Chat composer: `src/app/api/in-chat/[slug]/messages/route.ts`
 *  - In-Chat identify (lead novo): `src/app/api/in-chat/[slug]/identify/route.ts`
 *
 * Antes (PR #71), só o webhook do WhatsApp rodava IA, workflows NEW_LEAD,
 * round-robin, trackLeadEvent, alert engine, idle automation, etc. O
 * endpoint público do In-Chat salvava a mensagem mas NÃO disparava nada
 * disso — gap mapeado em Sprint 3.5.
 *
 * Este módulo extrai as etapas comuns num helper que ambos endpoints
 * chamam, garantindo **paridade estrutural** (não copy-paste). Qualquer
 * mudança futura no fluxo pós-inbound entra aqui, e os 3 endpoints ganham
 * automaticamente.
 *
 * Funções:
 *  - `firePostInboundAutomations()` — dispara todas as automações pós-save
 *    da mensagem. Idempotente do ponto de vista do caller (cada parte é
 *    try/catch interno; falha em uma não derruba as outras).
 *  - `createInChatLead()` — cria Lead+Conversation com source IN_CHAT,
 *    aciona round-robin + workflow NEW_LEAD + logActivity. Usado pelo
 *    identify quando phone novo.
 */

import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { inngest } from "@/inngest/client";
import { eventBus } from "@/features/alerts/lib/event-bus";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { assignLeadRoundRobin } from "@/http/rodizio/create-lead";
import { LeadSource } from "@/generated/prisma/enums";

const FETCH_TIMEOUT_MS = 10_000;

/* ────────────────────────────────────────────────────────────────────────
 * firePostInboundAutomations
 * ─────────────────────────────────────────────────────────────────────── */

export interface FirePostInboundParams {
  trackingId: string;
  organizationId: string;
  /** Se o tracking tem IA global ligada — controla disparo do Inngest. */
  globalAiActive: boolean;
  /** Lead já carregado da DB com os campos abaixo. */
  lead: {
    id: string;
    isActive: boolean;
    firstResponseAt: Date | null;
    lastInboundAt: Date | null;
    conversation: { id: string } | null;
  };
  /** Mensagem recém-criada (Message.id interno). */
  messageId: string;
  /** ID externo da mensagem (Message.messageId — do uazapi ou inchat-uuid). */
  externalMessageId: string;
  /** Se a mensagem é do atendente (fromMe=true) ou do lead (fromMe=false). */
  fromMe: boolean;
  /** Canal de origem — pro logging/IA decidir nome do event. */
  channel: "WHATSAPP" | "IN_CHAT" | "INSTAGRAM" | "FACEBOOK";
  /** Dados serializáveis pro Pusher per-conversation event. */
  messagePayload: Record<string, any>;
  /** Dados serializáveis pro Pusher per-tracking event (lista de conversas). */
  conversationPayload?: Record<string, any>;
}

/**
 * Dispara todas as automações pós-save de uma mensagem inbound:
 *  1. Atualiza timestamps (Conversation.lastMessage + Lead.{updatedAt,
 *     lastInboundAt|lastOutboundAt, firstResponseAt})
 *  2. trackLeadEvent (timeline da jornada)
 *  3. eventBus.publish "chat.message_received" (alert engine)
 *  4. Inngest "chat/ai.whatsapp-message-received" (IA — quando
 *     globalAiActive=true, lead ativo, fromMe=false)
 *     [NOTE] Mantemos o nome `whatsapp-message-received` por enquanto pra
 *     retro-compat com o listener existente. Em sprint futura renomear pra
 *     `chat/ai.message-received` (mais genérico) e adicionar canal no data.
 *  5. dispatchIdleActivityIfActive (automação de ociosidade — só fromMe=false)
 *  6. Pusher per-tracking + per-conversation
 *
 * Cada etapa é try/catch interno — falha numa não bloqueia as outras.
 * Comportamento espelha o webhook do WhatsApp (linhas 830-947 do route.ts).
 */
export async function firePostInboundAutomations(
  params: FirePostInboundParams,
): Promise<void> {
  const now = new Date();
  const shouldSetFirstResponse =
    params.fromMe &&
    !params.lead.firstResponseAt &&
    params.lead.lastInboundAt !== null;

  // ── 1. Update timestamps ─────────────────────────────────────────────
  try {
    await prisma.conversation.update({
      where: {
        leadId_trackingId: {
          leadId: params.lead.id,
          trackingId: params.trackingId,
        },
      },
      data: {
        lastMessage: { connect: { id: params.messageId } },
        lead: {
          update: {
            updatedAt: now,
            ...(params.fromMe
              ? { lastOutboundAt: now }
              : { lastInboundAt: now }),
            ...(shouldSetFirstResponse ? { firstResponseAt: now } : {}),
          },
        },
      },
    });
  } catch (err) {
    console.error("[pipeline] update_timestamps_failed", err);
  }

  // ── 2. trackLeadEvent (timeline) ─────────────────────────────────────
  try {
    if (params.fromMe) {
      await trackLeadEvent({
        leadId: params.lead.id,
        kind: "message_out",
        metadata: {
          channel: params.channel,
          messageId: params.externalMessageId,
        },
      });
      if (shouldSetFirstResponse) {
        await trackLeadEvent({
          leadId: params.lead.id,
          kind: "first_response",
          metadata: { channel: params.channel },
        });
      }
    } else {
      await trackLeadEvent({
        leadId: params.lead.id,
        kind: "message_in",
        metadata: {
          channel: params.channel,
          messageId: params.externalMessageId,
        },
      });
    }
  } catch (err) {
    console.error("[pipeline] track_lead_event_failed", err);
  }

  // ── 3. Alert engine (só inbound) ─────────────────────────────────────
  if (!params.fromMe && params.lead.conversation?.id) {
    try {
      await eventBus.publish("chat.message_received", {
        conversationId: params.lead.conversation.id,
        messageId: params.messageId,
        isInbound: true,
        orgId: params.organizationId,
      });
    } catch (err) {
      console.error("[pipeline] alert_publish_failed", err);
    }
  }

  // ── 4. Inngest IA (só inbound + IA ativa + lead ativo) ───────────────
  if (
    !params.fromMe &&
    params.lead.isActive &&
    params.globalAiActive &&
    params.lead.conversation?.id
  ) {
    try {
      await inngest.send({
        // Mantém o nome legado pra não quebrar handler existente em
        // src/inngest/functions/chat-ai-respond.ts. Channel no data
        // permite o listener distinguir origem (WhatsApp vs In-Chat).
        name: "chat/ai.whatsapp-message-received",
        data: {
          trackingId: params.trackingId,
          leadId: params.lead.id,
          conversationId: params.lead.conversation.id,
          messageId: params.messageId,
          organizationId: params.organizationId,
          channel: params.channel,
        },
      });
    } catch (err) {
      console.error("[pipeline] inngest_send_failed", err);
    }
  }

  // ── 5. Idle automation (só inbound) ──────────────────────────────────
  if (!params.fromMe) {
    try {
      const { dispatchIdleActivityIfActive } = await import(
        "@/features/tracking-settings/lib/idle-automation-gate"
      );
      await dispatchIdleActivityIfActive({
        leadId: params.lead.id,
        trackingId: params.trackingId,
        organizationId: params.organizationId,
      });
    } catch (err) {
      console.error("[pipeline] idle_gate_failed", err);
    }
  }

  // ── 6. Pusher (per-tracking + per-conversation) ──────────────────────
  try {
    if (params.conversationPayload) {
      await pusherServer.trigger(
        params.trackingId,
        "conversation:new",
        params.conversationPayload,
      );
    }
    if (params.lead.conversation?.id) {
      await pusherServer.trigger(
        params.lead.conversation.id,
        "message:new",
        params.messagePayload,
      );
    }
    await pusherServer.trigger(
      params.trackingId,
      "message:new",
      params.messagePayload,
    );
  } catch (err) {
    console.error("[pipeline] pusher_trigger_failed", err);
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * createInChatLead
 * ─────────────────────────────────────────────────────────────────────── */

export interface CreateInChatLeadParams {
  trackingId: string;
  /** Telefone normalizado (só dígitos). Unique per tracking. */
  phone: string;
  /** Nome do lead (do form de identify). */
  name: string;
  /** appOrigin pro workflow NEW_LEAD montar URL absoluta. */
  appOrigin?: string;
}

export interface CreateInChatLeadResult {
  lead: {
    id: string;
    name: string;
    phone: string | null;
    isActive: boolean;
    firstResponseAt: Date | null;
    lastInboundAt: Date | null;
    conversation: { id: string };
  };
  isNew: true;
}

/**
 * Cria um Lead novo via In-Chat (página pública identify) com paridade
 * de automações ao webhook do WhatsApp:
 *  - LeadSource = IN_CHAT
 *  - statusFlow = "WAITING" + statusId do primeiro status do tracking
 *  - lastInboundAt = now (lead acabou de chegar)
 *  - Conversation criada inline
 *  - assignLeadRoundRobin (atribuição automática a um atendente)
 *  - Workflow NEW_LEAD POST `/api/workflows/lead/new`
 *  - logActivity "lead.arrived" via In-Chat
 *
 * **NÃO** faz fetch do profile picture (webhook do uazapi sim — vem
 * da uazapi). In-Chat lead começa sem avatar; pode subir depois via
 * profile picker no chat composer.
 *
 * **NÃO** captura CTWA (Click-To-WhatsApp Ads — Meta) — In-Chat não tem
 * referral source de ads.
 *
 * Throws se o tracking não tem status configurado (não rola criar lead
 * sem statusId — DB enforce + funil quebra).
 */
export async function createInChatLead(
  params: CreateInChatLeadParams,
): Promise<CreateInChatLeadResult> {
  const tracking = await prisma.tracking.findUnique({
    where: { id: params.trackingId },
    select: { id: true, name: true, organizationId: true },
  });
  if (!tracking) {
    throw new Error("tracking_not_found");
  }

  // Pega o primeiro status do funil (order asc).
  const status = await prisma.status.findFirst({
    where: { trackingId: params.trackingId },
    select: { id: true },
    orderBy: { order: "asc" },
  });
  if (!status) {
    throw new Error("status_not_configured");
  }

  // Pega o menor `order` atual nesse status pra inserir o lead no topo
  // da coluna (mesmo padrão do webhook).
  const firstLead = await prisma.lead.findFirst({
    where: { statusId: status.id },
    select: { order: true },
    orderBy: { order: "asc" },
  });

  const remoteJid = `${params.phone}@s.whatsapp.net`;

  const createdLead = await prisma.lead.create({
    data: {
      name: params.name,
      statusId: status.id,
      phone: params.phone,
      trackingId: params.trackingId,
      source: LeadSource.IN_CHAT,
      order: firstLead ? Number(firstLead.order) - 1 : 0,
      statusFlow: "WAITING",
      lastInboundAt: new Date(),
      conversation: {
        create: {
          remoteJid,
          trackingId: params.trackingId,
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      isActive: true,
      firstResponseAt: true,
      lastInboundAt: true,
      conversation: { select: { id: true } },
    },
  });

  if (!createdLead.conversation) {
    throw new Error("conversation_creation_failed");
  }

  // ── logActivity (best-effort) ──────────────────────────────────────
  try {
    await logActivity({
      organizationId: tracking.organizationId,
      userId: "system",
      userName: "Sistema",
      userEmail: "sistema@nasa",
      appSlug: "tracking",
      action: "lead.arrived",
      actionLabel: `Um lead chegou no tracking "${tracking.name}" via In-Chat (${createdLead.name ?? params.phone})`,
      resource: createdLead.name ?? params.phone,
      resourceId: createdLead.id,
      metadata: {
        phone: params.phone,
        trackingName: tracking.name,
        source: "IN_CHAT",
      },
    });
  } catch (err) {
    console.error("[createInChatLead] log_activity_failed", err);
  }

  // ── Round-robin (best-effort) ──────────────────────────────────────
  try {
    await prisma.$transaction((tx) =>
      assignLeadRoundRobin(tx, createdLead.id),
    );
  } catch (err) {
    console.error("[createInChatLead] round_robin_failed", err);
  }

  // ── Workflow NEW_LEAD (best-effort, timeout) ───────────────────────
  try {
    const baseUrl = params.appOrigin ?? process.env.NEXT_PUBLIC_BASE_URL;
    if (baseUrl) {
      await fetch(
        `${baseUrl}/api/workflows/lead/new?trackingId=${params.trackingId}&leadId=${createdLead.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackingId: params.trackingId }),
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        },
      );
    }
  } catch (err) {
    console.error("[createInChatLead] workflow_new_lead_failed", err);
  }

  return {
    lead: {
      id: createdLead.id,
      name: createdLead.name,
      phone: createdLead.phone,
      isActive: createdLead.isActive,
      firstResponseAt: createdLead.firstResponseAt,
      lastInboundAt: createdLead.lastInboundAt,
      conversation: { id: createdLead.conversation.id },
    },
    isNew: true,
  };
}
