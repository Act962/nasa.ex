import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/client";
import z from "zod";

/**
 * Resolve um peer da Bolha de Conversa em um Lead + Conversation usando o phoneNumber
 * da WhatsAppInstance CONNECTED do peer. O Lead é criado (idempotente) no primeiro
 * Tracking do usuário logado que tenha instância conectada.
 *
 * Retorna { leadId, conversationId, trackingId, leadName, leadPhone } para que a UI
 * consiga montar o chat lateral reusando Body/Footer do tracking-chat.
 */
export const resolvePeerAsLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/resolve-peer-as-lead",
    summary: "Resolve peer userId to a Lead+Conversation for bubble chat",
  })
  .input(z.object({ peerUserId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const myUserId = context.user.id;
    const { peerUserId } = input;

    if (peerUserId === myUserId) {
      throw errors.BAD_REQUEST({ message: "Peer não pode ser você mesmo" });
    }

    // 1) Minha instância CONNECTED → define tracking de destino
    const myInstance = await prisma.whatsAppInstance.findFirst({
      where: {
        status: "CONNECTED",
        organization: { members: { some: { userId: myUserId } } },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, trackingId: true, organizationId: true, phoneNumber: true },
    });
    if (!myInstance || !myInstance.trackingId) {
      throw errors.BAD_REQUEST({ message: "Você precisa de uma instância WhatsApp conectada" });
    }
    const trackingId = myInstance.trackingId;

    // 2) Instância do peer → phone que usaremos como identificador do Lead
    const peerInstance = await prisma.whatsAppInstance.findFirst({
      where: {
        status: "CONNECTED",
        organization: { members: { some: { userId: peerUserId } } },
      },
      orderBy: { updatedAt: "desc" },
      select: { phoneNumber: true, profileName: true },
    });
    if (!peerInstance?.phoneNumber) {
      throw errors.BAD_REQUEST({ message: "Peer ainda não conectou o WhatsApp" });
    }
    const peerPhone = peerInstance.phoneNumber;

    // 3) Dados do peer (nome fallback)
    const peerUser = await prisma.user.findUnique({
      where: { id: peerUserId },
      select: { name: true },
    });
    const leadName = peerInstance.profileName || peerUser?.name || peerPhone;

    // 4) Status default (menor order) no tracking
    const defaultStatus = await prisma.status.findFirst({
      where: { trackingId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    if (!defaultStatus) {
      throw errors.BAD_REQUEST({ message: "Tracking sem colunas de status configuradas" });
    }

    // 5) Upsert Lead (phone_trackingId é único)
    const lead = await prisma.$transaction(async (tx) => {
      const existing = await tx.lead.findUnique({
        where: { phone_trackingId: { phone: peerPhone, trackingId } },
        select: { id: true, name: true, phone: true },
      });
      if (existing) return existing;

      const lastLead = await tx.lead.findFirst({
        where: { statusId: defaultStatus.id, trackingId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const newOrder = lastLead ? new Decimal(lastLead.order).plus(1) : new Decimal(0);

      return tx.lead.create({
        data: {
          name: leadName,
          phone: peerPhone,
          statusId: defaultStatus.id,
          trackingId,
          order: newOrder,
          responsibleId: myUserId,
          source: "WHATSAPP",
        },
        select: { id: true, name: true, phone: true },
      });
    });

    // 6) Resolve Conversation — idempotente por (remoteJid, trackingId) E
    // (leadId, trackingId). Se já existe Conversation com o mesmo remoteJid
    // mas linkada a outro Lead (cenário: phone trocou de Lead), atualizamos
    // o leadId em vez de tentar criar uma nova e violar a constraint unique.
    const remoteJid = `${peerPhone}@s.whatsapp.net`;
    let conversation = await prisma.conversation.findUnique({
      where: { remoteJid_trackingId: { remoteJid, trackingId } },
      select: { id: true, leadId: true },
    });
    if (conversation) {
      // Re-aponta pro Lead atual se necessário (mantém histórico, troca dono).
      if (conversation.leadId !== lead.id) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { leadId: lead.id },
        });
      }
    } else {
      conversation = await prisma.conversation.create({
        data: {
          trackingId,
          leadId: lead.id,
          remoteJid,
        },
        select: { id: true, leadId: true },
      });
    }

    return {
      leadId: lead.id,
      conversationId: conversation.id,
      trackingId,
      leadName: lead.name,
      leadPhone: lead.phone ?? peerPhone,
    };
  });
