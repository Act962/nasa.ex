import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Opções de filtro da base de contatos: colunas e participantes do tracking
 * selecionado (per-tracking) + tags da org. Sem `trackingId`, só devolve as
 * tags org-wide (colunas/participantes ficam vazios até escolher um tracking).
 */
export const contactFilterOptions = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ trackingId: z.string().optional() }))
  .handler(async ({ input, context }) => {
    const { org } = context;

    const scopedTracking = input.trackingId
      ? await prisma.tracking.findFirst({
          where: { id: input.trackingId, organizationId: org.id },
          select: { id: true },
        })
      : null;
    const trackingId = scopedTracking?.id;

    const [columns, tags, participants] = await Promise.all([
      trackingId
        ? prisma.status.findMany({
            where: { trackingId },
            orderBy: { order: "asc" },
            select: { id: true, name: true, color: true },
          })
        : Promise.resolve([]),
      prisma.tag.findMany({
        where: {
          organizationId: org.id,
          archivedAt: null,
          ...(trackingId
            ? { OR: [{ trackingId }, { trackingId: null }] }
            : {}),
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, color: true },
      }),
      trackingId
        ? prisma.trackingParticipant.findMany({
            where: { trackingId },
            orderBy: { user: { name: "asc" } },
            select: {
              user: { select: { name: true, email: true, image: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    return {
      columns,
      tags: tags.map((tag) => ({
        ...tag,
        color: tag.color ?? "#1447e6",
      })),
      participants: participants.map((participant) => participant.user),
    };
  });
