import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista compras pendentes / pagas-aguardando-resgate da org criadora.
 *
 * Lê `PendingCoursePurchase` — usado para visibilidade de funil:
 *  - `PENDING`  → checkout iniciado, ainda não pago no Stripe.
 *  - `PAID`     → pago, mas ainda não virou enrollment (fluxo público
 *                 aguarda o comprador criar conta via signupToken).
 *  - `EXPIRED`  → signupToken passou de 7 dias sem ser resgatado.
 *  - `CANCELLED`→ checkout abandonado ou erro Stripe.
 *
 * Por padrão exclui `REDEEMED` (essas viram enrollment e aparecem em
 * `creatorListSales`).
 */
export const creatorListPendingSales = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z
      .object({
        courseId: z.string().optional(),
        statuses: z
          .array(z.enum(["PENDING", "PAID", "EXPIRED", "CANCELLED", "REDEEMED"]))
          .optional(),
        search: z.string().trim().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(50),
      })
      .default({}),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;
    const { courseId, statuses, search, page, pageSize } = input;

    const where = {
      course: { creatorOrgId: orgId },
      ...(courseId ? { courseId } : {}),
      status: { in: statuses ?? (["PENDING", "PAID", "EXPIRED"] as const) },
      ...(search
        ? { email: { contains: search, mode: "insensitive" as const } }
        : {}),
    } as const;

    const [rows, total, counts] = await Promise.all([
      prisma.pendingCoursePurchase.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          flow: true,
          status: true,
          amountBrlCents: true,
          priceStars: true,
          stripeSessionId: true,
          stripePaymentIntentId: true,
          createdAt: true,
          paidAt: true,
          tokenExpiresAt: true,
          course: { select: { id: true, slug: true, title: true } },
          plan: { select: { id: true, name: true } },
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      }),
      prisma.pendingCoursePurchase.count({ where }),
      prisma.pendingCoursePurchase.groupBy({
        by: ["status"],
        where: { course: { creatorOrgId: orgId } },
        _count: { _all: true },
      }),
    ]);

    const countsByStatus = Object.fromEntries(
      counts.map((c) => [c.status, c._count._all]),
    ) as Partial<Record<string, number>>;

    return {
      pending: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      countsByStatus,
    };
  });
