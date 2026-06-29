import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista alertas críticos pendentes de confirmação pelo usuário.
 *
 * "Pendente" = severity=critical AND requiresAck AND ainda sem acknowledgedAt.
 *
 * Usado pelo `AlertProvider` no mount pra reabrir popup se user fechou a aba
 * com algo não confirmado. Limite 3 — evita avalanche.
 */
export const pendingCriticals = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/alerts/pending-criticals",
    summary: "Lista alertas críticos pendentes de ack pelo usuário",
  })
  .input(z.object({}).optional())
  .output(
    z.object({
      items: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          body: z.string(),
          actionUrl: z.string().nullable(),
          requiresAck: z.boolean(),
          createdAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const userId = context.user.id;

    const userOrgs = await prisma.member
      .findMany({
        where: { userId },
        select: { organizationId: true },
      })
      .then((m) => m.map((x) => x.organizationId));

    const items = await prisma.adminNotification.findMany({
      where: {
        severity: "critical",
        requiresAck: true,
        OR: [
          { targetType: "all" },
          { targetType: "user", targetId: userId },
          { targetType: "org", targetId: { in: userOrgs } },
        ],
        reads: {
          none: { userId, acknowledgedAt: { not: null } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        body: true,
        actionUrl: true,
        requiresAck: true,
        createdAt: true,
      },
    });

    return {
      items: items.map((i) => ({
        id: i.id,
        title: i.title,
        body: i.body,
        actionUrl: i.actionUrl ?? null,
        requiresAck: i.requiresAck,
        createdAt: i.createdAt.toISOString(),
      })),
    };
  });
