import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista de disputas pra admin resolver. Inclui:
 *  - EventClaims status=REJECTED (criador rejeitou, admin precisa decidir)
 *  - EventClaims status=ADMIN_RESOLVED (resolvidos, pra histórico)
 *  - Resumo de reports PENDING por evento (pra investigar score alto)
 *
 * Ordenado por `createdAt DESC` por padrão. Filtros: status, evento.
 */
export const listDisputes = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      status: z
        .enum(["PENDING", "REJECTED", "ACCEPTED", "EXPIRED", "ADMIN_RESOLVED", "ALL"])
        .default("REJECTED"),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(25),
    }),
  )
  .handler(async ({ input }) => {
    const where =
      input.status === "ALL" ? {} : { status: input.status };

    const [claims, total] = await Promise.all([
      prisma.eventClaim.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: {
          action: {
            select: {
              id: true,
              title: true,
              publicSlug: true,
              isPublic: true,
              isDisputed: true,
              disputeReason: true,
              reportScore: true,
              createdBy: true,
              creator: { select: { name: true, email: true } },
              organization: { select: { name: true, isVerified: true } },
              _count: {
                select: {
                  reports: { where: { status: "PENDING" } },
                },
              },
            },
          },
        },
      }),
      prisma.eventClaim.count({ where }),
    ]);

    return {
      claims,
      total,
      page: input.page,
      limit: input.limit,
      pages: Math.ceil(total / input.limit),
    };
  });
