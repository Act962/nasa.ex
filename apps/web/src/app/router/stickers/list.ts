import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista figurinhas (UserSticker) da organização atual.
 *
 * Todas as figurinhas são visíveis pra todos os membros da org — facilita
 * padronizar identidade visual da equipe (mesmo banco de figurinhas usado
 * por todos os atendentes).
 *
 * Ordenadas por `createdAt desc` (mais recentes no topo do picker).
 */
export const listStickers = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/stickers/list",
    summary: "Lista figurinhas da organização",
    tags: ["Stickers", "Tracking Chat"],
  })
  .input(z.object({}))
  .output(
    z.object({
      items: z.array(
        z.object({
          id: z.string(),
          url: z.string(),
          mimetype: z.string(),
          label: z.string().nullable(),
          createdAt: z.date(),
          ownedByMe: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const stickers = await prisma.userSticker.findMany({
      where: { organizationId: context.org.id },
      select: {
        id: true,
        url: true,
        mimetype: true,
        label: true,
        createdAt: true,
        userId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      items: stickers.map((s) => ({
        id: s.id,
        url: s.url,
        mimetype: s.mimetype,
        label: s.label,
        createdAt: s.createdAt,
        ownedByMe: s.userId === context.user.id,
      })),
    };
  });
