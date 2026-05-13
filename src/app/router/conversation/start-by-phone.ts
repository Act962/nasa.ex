import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { LeadAction, LeadSource } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { validWhatsappPhone } from "@/http/uazapi/valid-whatsapp-phone";
import z from "zod";
import { recordLeadHistory } from "../leads/utils/history";

export const startConversationByPhone = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/conversation/start-by-phone",
    summary: "Find or create lead + conversation by phone",
  })
  .input(
    z.object({
      trackingId: z.string(),
      phone: z.string(),
      name: z.string().optional(),
      token: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const normalized = input.phone.replace(/\D/g, "");
    if (!normalized) throw new Error("Telefone inválido");

    const [valid] = await validWhatsappPhone({
      token: input.token,
      data: { numbers: [normalized] },
    });

    if (!valid?.isInWhatsapp) {
      throw new Error("Número não está no WhatsApp");
    }

    let lead = await prisma.lead.findUnique({
      where: {
        phone_trackingId: {
          phone: normalized,
          trackingId: input.trackingId,
        },
      },
      select: { id: true, conversation: { select: { id: true } } },
    });

    if (!lead) {
      const status = await prisma.status.findFirst({
        where: { trackingId: input.trackingId },
        select: { id: true },
        orderBy: { order: "asc" },
      });
      if (!status) throw new Error("Status inicial não encontrado");

      const firstLead = await prisma.lead.findFirst({
        where: { statusId: status.id },
        select: { order: true },
        orderBy: { order: "asc" },
      });

      const created = await prisma.lead.create({
        data: {
          name: input.name?.trim() || normalized,
          statusId: status.id,
          phone: normalized,
          trackingId: input.trackingId,
          source: LeadSource.WHATSAPP,
          order: firstLead ? Number(firstLead.order) - 1 : 0,
          statusFlow: "ACTIVE",
        },
        select: { id: true, conversation: { select: { id: true } } },
      });
      lead = created;
    }

    const conversation = await prisma.conversation.upsert({
      where: {
        leadId_trackingId: {
          leadId: lead.id,
          trackingId: input.trackingId,
        },
      },
      create: {
        trackingId: input.trackingId,
        leadId: lead.id,
        remoteJid: valid.jid || `${normalized}@s.whatsapp.net`,
        isActive: true,
      },
      update: {},
      select: { id: true },
    });

    await recordLeadHistory({
      leadId: lead.id,
      userId: context.user.id,
      action: LeadAction.ACTIVE,
      notes: "Conversa iniciada a partir de contato",
    });

    return { conversationId: conversation.id, leadId: lead.id };
  });
