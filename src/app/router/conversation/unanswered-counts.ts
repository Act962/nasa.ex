import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Leads sem resposta por canal, para o contador nos ícones do Tracking Chat.
 *
 * "Sem resposta" = a última mensagem da conversa é do lead: mandou algo
 * (`lastInboundAt`) e ninguém respondeu depois (`lastOutboundAt` vazio ou
 * anterior). Mesma régua do alerta "lead esperando" do ASTRO (spec 0029).
 */
/**
 * Lead esperando: mandou algo (`lastInboundAt`) e ninguém respondeu depois.
 * Função porque `prisma.lead.fields` precisa do cliente já carregado.
 */
function awaitingReplyFilter(): Prisma.LeadWhereInput {
  return {
    isArchived: false,
    lastInboundAt: { not: null },
    OR: [
      { lastOutboundAt: null },
      { lastOutboundAt: { lt: prisma.lead.fields.lastInboundAt } },
    ],
  };
}

export const getUnansweredCounts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ trackingId: z.string() }))
  .handler(async ({ context, input }) => {
    const tracking = await prisma.tracking.findFirst({
      where: { id: input.trackingId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!tracking) return { byChannel: {} as Record<string, number>, total: 0 };


    // Chat do site e ASTRO CHAT são gravados como WhatsApp: separa pela origem
    // do lead, igual ao filtro da lista.
    const awaitingReply = awaitingReplyFilter();

    const countBySource = (source: "IN_CHAT" | "ASTRO_CHAT") =>
      prisma.conversation.count({
        where: { trackingId: tracking.id, isActive: true, lead: { ...awaitingReply, source } },
      });
    const [groups, inChatCount, astroChatCount] = await Promise.all([
      prisma.conversation.groupBy({
        by: ["channel"],
        where: {
          trackingId: tracking.id,
          isActive: true,
          lead: { ...awaitingReply, source: { notIn: ["IN_CHAT", "ASTRO_CHAT"] } },
        },
        _count: { _all: true },
      }),
      countBySource("IN_CHAT"),
      countBySource("ASTRO_CHAT"),
    ]);

    const byChannel: Record<string, number> = { IN_CHAT: inChatCount, ASTRO_CHAT: astroChatCount };
    let total = inChatCount + astroChatCount;
    for (const group of groups) {
      byChannel[group.channel] = group._count._all;
      total += group._count._all;
    }
    return { byChannel, total };
  });

/**
 * Total de leads esperando resposta na organização inteira — a bolinha no
 * ícone Chat do menu lateral. Somatória dos canais de todos os trackings, sem
 * abrir o app.
 */
export const getUnansweredTotal = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const total = await prisma.conversation.count({
      where: {
        isActive: true,
        tracking: { organizationId: context.org.id },
        lead: awaitingReplyFilter(),
      },
    });
    return { total };
  });
