import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import z from "zod";
import prisma from "@/lib/prisma";

export const findConversationByPhone = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/conversation/find-by-phone",
    summary: "Find conversation by phone in tracking",
  })
  .input(
    z.object({
      trackingId: z.string(),
      phone: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const normalized = input.phone.replace(/\D/g, "");
    if (!normalized) return { conversationId: null, leadId: null };

    const lead = await prisma.lead.findUnique({
      where: {
        phone_trackingId: {
          phone: normalized,
          trackingId: input.trackingId,
        },
      },
      select: {
        id: true,
        conversation: { select: { id: true } },
      },
    });

    return {
      conversationId: lead?.conversation?.id ?? null,
      leadId: lead?.id ?? null,
    };
  });
