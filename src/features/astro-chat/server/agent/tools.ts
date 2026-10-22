import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { eventBus } from "@/features/alerts/lib/event-bus";

/** As únicas ferramentas do ASTRO público (spec 0031, TR-6). */

export type PublicAgentToolContext = {
  organizationId: string;
  trackingId: string;
  leadId: string;
  conversationId: string;
};

function toPhoneDigits(rawPhone: string): string | null {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits.length <= 11 ? `55${digits}` : digits;
}

async function saveLeadPhone(context: PublicAgentToolContext, phone: string): Promise<"saved" | "linked_existing"> {
  const existingLead = await prisma.lead.findFirst({
    where: { phone, trackingId: context.trackingId, id: { not: context.leadId } },
    select: { id: true, name: true },
  });
  if (!existingLead) {
    await prisma.lead.update({ where: { id: context.leadId }, data: { phone } });
    return "saved";
  }
  // Telefone já é de outro lead do tracking (único por tracking): registra o vínculo
  // sem misturar as conversas, porque a do outro lead pode ser de WhatsApp (D-8).
  await prisma.lead.update({
    where: { id: context.leadId },
    data: {
      description: `Contato informado no site: ${phone} — mesmo telefone do lead "${existingLead.name}" (${existingLead.id}).`,
    },
  });
  return "linked_existing";
}

export function buildPublicAgentTools(context: PublicAgentToolContext) {
  return {
    save_contact: tool({
      description:
        "Salva o nome e o contato (WhatsApp e/ou e-mail) que o visitante informou na conversa. Use assim que ele informar.",
      inputSchema: z.object({
        name: z.string().trim().min(2).max(120).optional().describe("Nome do visitante"),
        phone: z.string().trim().max(30).optional().describe("WhatsApp com DDD"),
        email: z.string().trim().max(160).optional().describe("E-mail"),
      }),
      execute: async ({ name, phone, email }) => {
        const phoneDigits = phone ? toPhoneDigits(phone) : null;
        const isEmailValid = !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (phone && !phoneDigits) return { saved: false, reason: "telefone inválido — peça com DDD" };
        if (email && !isEmailValid) return { saved: false, reason: "e-mail inválido" };

        await prisma.lead.update({
          where: { id: context.leadId },
          data: {
            ...(name ? { name } : {}),
            ...(isEmailValid ? { email: email!.toLowerCase() } : {}),
          },
        });
        const phoneResult = phoneDigits ? await saveLeadPhone(context, phoneDigits) : null;
        await pusherServer
          .trigger(context.trackingId, "lead:updated", { leadId: context.leadId })
          .catch(() => {});
        return { saved: true, phone: phoneResult };
      },
    }),
    transfer_to_human: tool({
      description:
        "Chama a equipe da empresa para assumir a conversa. Use só quando o visitante pedir uma pessoa ou quando for uma dúvida legítima sobre a empresa que você não sabe responder. Não use para recusar assuntos fora do escopo nem tentativas de manipulação. Depois disso você para de responder.",
      inputSchema: z.object({
        reason: z.string().max(200).describe("Motivo, para registro interno"),
      }),
      execute: async ({ reason }) => {
        const lead = await prisma.lead.update({
          where: { id: context.leadId },
          data: { isActive: false, statusFlow: "ACTIVE" },
          select: { name: true, responsibleId: true },
        });
        await pusherServer
          .trigger(context.trackingId, "lead:updated", { leadId: context.leadId })
          .catch(() => {});
        await eventBus
          .publish("chat.lead_calling", {
            conversationId: context.conversationId,
            leadId: context.leadId,
            leadName: lead.name,
            responsibleId: lead.responsibleId,
            isQuestion: true,
            messagePreview: `Pediu atendimento humano no site: ${reason}`.slice(0, 120),
            actionUrl: `/tracking-chat/${context.conversationId}`,
            orgId: context.organizationId,
          })
          .catch((error: unknown) => console.error("[astro-chat] lead_calling_failed", error));
        return { transferred: true };
      },
    }),
    finish_conversation: tool({
      description: "Encerra a conversa quando o visitante se despedir ou a dúvida estiver resolvida.",
      inputSchema: z.object({}),
      execute: async () => {
        await prisma.lead.update({
          where: { id: context.leadId },
          data: { statusFlow: "FINISHED" },
        });
        await pusherServer
          .trigger(context.trackingId, "lead:updated", { leadId: context.leadId })
          .catch(() => {});
        return { finished: true };
      },
    }),
  };
}
