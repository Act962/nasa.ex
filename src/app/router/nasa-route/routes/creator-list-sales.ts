import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista vendas confirmadas (matrículas pagas) da org criadora.
 *
 * Lê `NasaRouteEnrollment` — fonte de verdade de quem pagou e tem acesso ao
 * curso. Inclui matrículas via Stripe (`stripe_purchase`), pagas em Stars
 * (`purchase`, legado) e free-access (`free_access`) para visibilidade total.
 *
 * Filtros: courseId, source, status, intervalo de datas, busca por
 * nome/email do comprador. Paginação por offset (page/pageSize).
 *
 * NOTA: a versão anterior listava transações `StarTransaction.COURSE_PAYOUT`
 * (extrato de Stars recebidos). Mantida como `creatorListPayouts` para
 * reconciliação interna se necessário no futuro.
 */
export const creatorListSales = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      courseId: z.string().optional(),
      source: z
        .enum(["stripe_purchase", "purchase", "free_access", "gift"])
        .optional(),
      status: z.enum(["active", "refunded"]).optional(),
      search: z.string().trim().optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(50),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;
    const { courseId, source, status, search, from, to, page, pageSize } =
      input;

    const where = {
      course: { creatorOrgId: orgId },
      ...(courseId ? { courseId } : {}),
      ...(source ? { source } : {}),
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            enrolledAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            user: {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    } as const;

    const [rows, total, totals] = await Promise.all([
      prisma.nasaRouteEnrollment.findMany({
        where,
        orderBy: { enrolledAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          enrolledAt: true,
          completedAt: true,
          source: true,
          status: true,
          paidStars: true,
          paidBrlCents: true,
          stripeCheckoutSessionId: true,
          stripePaymentIntentId: true,
          user: {
            select: { id: true, name: true, email: true, phone: true, image: true },
          },
          course: { select: { id: true, slug: true, title: true } },
          plan: { select: { id: true, name: true } },
        },
      }),
      prisma.nasaRouteEnrollment.count({ where }),
      prisma.nasaRouteEnrollment.aggregate({
        where: { ...where, status: "active" },
        _sum: { paidBrlCents: true, paidStars: true },
        _count: { _all: true },
      }),
    ]);

    return {
      sales: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      totals: {
        count: totals._count._all,
        paidBrlCents: totals._sum.paidBrlCents ?? 0,
        payoutStars: totals._sum.paidStars ?? 0,
      },
    };
  });
