import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  LeadAction,
  LeadSource,
  MessageChannel,
} from "@/generated/prisma/enums";
import { recordLeadHistory } from "../leads/utils/history";
import { logActivity } from "@/features/admin/lib/activity-logger";

/**
 * Abre (ou cria) uma conversa **privada** com um participante de grupo.
 *
 * Usado pelas ações do menu da mensagem em grupos:
 *  - "Responder em particular"
 *  - "Conversar com [Nome]"
 *  - "Adicionar Novo Lead"
 *
 * O `senderId` chega como JID do uazapi (ex: `5511999998888@s.whatsapp.net`).
 * Extraímos o telefone, normalizamos (E.164 BR-friendly) e fazemos
 * find-or-create do Lead no mesmo tracking da conversa origem.
 *
 * Diferente de `start-by-phone.ts` (que valida via uazapi /chat/find),
 * aqui pulamos a validação WhatsApp porque o participante JÁ está num
 * grupo conhecido — sabemos que tem WhatsApp ativo.
 *
 * Cobra 0★ (operação interna do inbox).
 */

const JID_PHONE_REGEX = /^(\d+)@/;

function extractPhoneFromJid(jid: string | null | undefined): string | null {
  if (!jid) return null;
  const m = JID_PHONE_REGEX.exec(jid);
  if (!m) return null;
  // Mantém só dígitos; uazapi às vezes manda no formato `551199...@s.whatsapp.net`
  // sem `+`. Salvar como dígitos puros bate com o padrão usado em
  // `start-by-phone.ts`.
  return m[1].replace(/\D/g, "") || null;
}

export const startFromGroupParticipant = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/conversation/start-from-group-participant",
    summary: "Abre conversa privada com participante de grupo (find or create lead)",
    tags: ["Conversation", "Tracking Chat"],
  })
  .input(
    z.object({
      /** Conversa de origem (grupo). Usado pra inferir trackingId. */
      sourceConversationId: z.string().min(1),
      /** JID do participante remetente (ex: `551199...@s.whatsapp.net`). */
      senderId: z.string().min(1),
      /** Nome capturado da mensagem original (fallback do display name). */
      senderName: z.string().nullable().optional(),
      /**
       * Ação pretendida — só pra log + decidir o redirect no client.
       * Não muda nada no DB.
       */
      intent: z
        .enum(["reply_private", "chat_with", "add_as_lead"])
        .default("chat_with"),
    }),
  )
  .output(
    z.object({
      leadId: z.string(),
      conversationId: z.string(),
      /** True se o Lead foi criado agora; false se já existia. */
      leadCreated: z.boolean(),
      /** True se a Conversation foi criada agora; false se já existia. */
      conversationCreated: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // 1) Carrega conversa de origem pra obter trackingId + validar org
    const source = await prisma.conversation.findUnique({
      where: { id: input.sourceConversationId },
      select: {
        trackingId: true,
        isGroup: true,
        tracking: {
          select: { organizationId: true, name: true },
        },
      },
    });
    if (!source) {
      throw errors.NOT_FOUND({ message: "Conversa de origem não encontrada" });
    }
    if (source.tracking.organizationId !== context.org.id) {
      throw errors.FORBIDDEN({ message: "Sem permissão pra essa conversa" });
    }
    if (!source.isGroup) {
      // Ação só faz sentido em grupos — em conversa individual, o "participante"
      // É o próprio lead da conversa.
      throw errors.BAD_REQUEST({
        message: "Conversa de origem não é um grupo",
      });
    }

    const phone = extractPhoneFromJid(input.senderId);
    if (!phone) {
      throw errors.BAD_REQUEST({
        message:
          "Não consegui extrair telefone do participante (JID inválido ou faltando).",
      });
    }

    // 2) Status inicial pro Lead novo (primeira coluna do tracking).
    // Se o tracking não tem nenhuma coluna, é setup inválido — bloqueia.
    const defaultStatus = await prisma.status.findFirst({
      where: { trackingId: source.trackingId },
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    });
    if (!defaultStatus) {
      throw errors.BAD_REQUEST({
        message:
          "Tracking não tem coluna inicial. Crie uma coluna antes de adicionar leads.",
      });
    }

    // 3) Find-or-create do Lead (dedup por phone + trackingId)
    let leadCreated = false;
    let lead = await prisma.lead.findUnique({
      where: {
        phone_trackingId: {
          phone,
          trackingId: source.trackingId,
        },
      },
      select: { id: true, name: true },
    });

    if (!lead) {
      // Order: insere no topo da primeira coluna (mesmo padrão do
      // start-by-phone — coloca antes do menor `order` atual).
      const firstLead = await prisma.lead.findFirst({
        where: { statusId: defaultStatus.id },
        select: { order: true },
        orderBy: { order: "asc" },
      });

      const displayName = input.senderName?.trim() || phone;

      lead = await prisma.lead.create({
        data: {
          name: displayName,
          phone,
          trackingId: source.trackingId,
          statusId: defaultStatus.id,
          source: LeadSource.WHATSAPP,
          statusFlow: "ACTIVE",
          order: firstLead ? Number(firstLead.order) - 1 : 0,
        },
        select: { id: true, name: true },
      });
      leadCreated = true;

      await recordLeadHistory({
        leadId: lead.id,
        userId: context.user.id,
        action: LeadAction.ACTIVE,
        notes: `Lead criado a partir de participante do grupo (origem: ${input.sourceConversationId})`,
      });
    }

    // 4) Find-or-create da Conversation privada (1:1 com esse lead no mesmo
    // tracking). Reusa se já existe — abre direto sem duplicar.
    let conversationCreated = false;
    let conversation = await prisma.conversation.findFirst({
      where: {
        leadId: lead.id,
        trackingId: source.trackingId,
        // Conversa PRIVADA — não confundir com a do grupo
        isGroup: false,
      },
      select: { id: true },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          trackingId: source.trackingId,
          leadId: lead.id,
          remoteJid: `${phone}@s.whatsapp.net`,
          channel: MessageChannel.WHATSAPP,
          isActive: true,
          isGroup: false,
        },
        select: { id: true },
      });
      conversationCreated = true;
    }

    // 5) Audit log
    const actionLabel =
      input.intent === "add_as_lead"
        ? `Adicionou ${lead.name} como novo lead (a partir de grupo)`
        : input.intent === "reply_private"
          ? `Iniciou resposta em particular pra ${lead.name}`
          : `Abriu conversa privada com ${lead.name}`;

    logActivity({
      organizationId: source.tracking.organizationId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image ?? null,
      appSlug: "chat",
      subAppSlug: "tracking-chat",
      featureKey: `chat.group.${input.intent}`,
      action: `chat.group.${input.intent}`,
      actionLabel,
      resource: "lead",
      resourceId: lead.id,
      metadata: {
        sourceConversationId: input.sourceConversationId,
        trackingName: source.tracking.name,
        senderId: input.senderId,
        senderName: input.senderName,
        leadCreated,
        conversationCreated,
        intent: input.intent,
      },
    }).catch(() => {});

    return {
      leadId: lead.id,
      conversationId: conversation.id,
      leadCreated,
      conversationCreated,
    };
  });
