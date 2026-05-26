import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * In-Chat — status do modo anti-ban + modo manual pra um tracking.
 *
 * Usado pelo banner `<InChatActiveBanner>` no `/tracking-chat` pra avisar
 * o atendente quando o WhatsApp tá fora do ar (auto) OU quando owner
 * ativou manualmente o canal alternativo (manual). Inclui a URL pública
 * pra owner copiar e disparar manualmente.
 *
 * Return ampliado pra suportar o toggle manual (Sprint 3.5):
 *  - `source`: indica origem da ativação ("off"|"auto"|"manual"|"both")
 *  - `manualEnabled`: estado bruto do flag manual
 *  - `manualSetBy`/`manualSetAt`: quem ativou e quando (banner mostra)
 *  - `instanceId`: necessário pro toggle do owner em chat-settings
 */
export const getInChatStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/conversation/get-in-chat-status",
    summary: "Status do In-Chat (auto/manual) pra um tracking",
    tags: ["Conversation", "In-Chat"],
  })
  .input(
    z.object({
      trackingId: z.string().min(1),
    }),
  )
  .output(
    z.object({
      /** Auto OU manual ligado — equivalente a "banner deve aparecer". */
      active: z.boolean(),
      /** Origem da ativação. */
      source: z.enum(["off", "auto", "manual", "both"]),
      phoneNumber: z.string().nullable(),
      /** Quando o modo auto foi ligado (banimento detectado). */
      activatedAt: z.date().nullable(),
      /** Slug da org pra montar a URL `/whatsapp/[slug]`. */
      orgSlug: z.string(),
      failureCount: z.number().int(),
      /** ID da instância — usado pelo toggle do owner. */
      instanceId: z.string().nullable(),
      /** Estado bruto do flag manual. */
      manualEnabled: z.boolean(),
      /** Quem ativou o manual (null se nunca ativado ou desligado). */
      manualSetBy: z
        .object({
          id: z.string(),
          name: z.string(),
        })
        .nullable(),
      manualSetAt: z.date().nullable(),
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
            id: true,
            inChatModeActive: true,
            inChatActivatedAt: true,
            inChatFailureCount: true,
            inChatModeManual: true,
            inChatManualSetBy: true,
            inChatManualSetAt: true,
            phoneNumber: true,
          },
        },
      },
    });
    if (!tracking || tracking.organizationId !== context.org.id) {
      throw errors.NOT_FOUND({ message: "Tracking não encontrado" });
    }

    const inst = tracking.whatsappInstance;
    const auto = !!inst?.inChatModeActive;
    const manual = !!inst?.inChatModeManual;

    // Lookup do usuário que ativou manual (se houver)
    let manualSetBy: { id: string; name: string } | null = null;
    if (manual && inst?.inChatManualSetBy) {
      const user = await prisma.user.findUnique({
        where: { id: inst.inChatManualSetBy },
        select: { id: true, name: true },
      });
      if (user) manualSetBy = { id: user.id, name: user.name };
    }

    const source: "off" | "auto" | "manual" | "both" =
      auto && manual
        ? "both"
        : auto
          ? "auto"
          : manual
            ? "manual"
            : "off";

    return {
      active: auto || manual,
      source,
      phoneNumber: inst?.phoneNumber ?? null,
      activatedAt: inst?.inChatActivatedAt ?? null,
      orgSlug: tracking.organization.slug,
      failureCount: inst?.inChatFailureCount ?? 0,
      instanceId: inst?.id ?? null,
      manualEnabled: manual,
      manualSetBy,
      manualSetAt: inst?.inChatManualSetAt ?? null,
    };
  });
