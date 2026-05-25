import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * In-Chat — status do modo anti-ban pra um tracking.
 *
 * Usado pelo banner `<InChatActiveBanner>` no `/tracking-chat` pra avisar
 * o atendente quando o WhatsApp tá fora do ar e o In-Chat assumiu. Inclui
 * a URL pública pra owner copiar e disparar manualmente.
 */
export const getInChatStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/conversation/get-in-chat-status",
    summary: "Verifica se a instância do tracking está em modo In-Chat",
    tags: ["Conversation", "In-Chat"],
  })
  .input(
    z.object({
      trackingId: z.string().min(1),
    }),
  )
  .output(
    z.object({
      active: z.boolean(),
      phoneNumber: z.string().nullable(),
      activatedAt: z.date().nullable(),
      /** Slug da org pra montar a URL `/whatsapp/[slug]`. */
      orgSlug: z.string(),
      failureCount: z.number().int(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const tracking = await prisma.tracking.findUnique({
      where: { id: input.trackingId },
      select: {
        organizationId: true,
        organization: { select: { slug: true } },
        whatsappInstance: {
          select: {
            inChatModeActive: true,
            inChatActivatedAt: true,
            inChatFailureCount: true,
            phoneNumber: true,
          },
        },
      },
    });
    if (!tracking || tracking.organizationId !== context.org.id) {
      throw errors.NOT_FOUND({ message: "Tracking não encontrado" });
    }

    return {
      active: !!tracking.whatsappInstance?.inChatModeActive,
      phoneNumber: tracking.whatsappInstance?.phoneNumber ?? null,
      activatedAt: tracking.whatsappInstance?.inChatActivatedAt ?? null,
      orgSlug: tracking.organization.slug,
      failureCount: tracking.whatsappInstance?.inChatFailureCount ?? 0,
    };
  });
