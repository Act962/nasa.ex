import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Últimos formulários preenchidos na org ativa — usado no carrossel acima de
 * "Todos os forms" no /form. Junta lead, status, tracking e responsável pra
 * cada resposta, pra montar o card sem N+1.
 *
 * Busca opcional: filtro `query` busca por nome do formulário, nome do lead
 * OU pelo `label` da resposta (que é derivado dos campos marcados como
 * "Usar valor como título da resposta").
 */
export const listRecentResponses = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      query: z.string().trim().max(120).optional(),
      limit: z.number().int().min(1).max(60).default(24),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;
    const q = input.query && input.query.length > 0 ? input.query : undefined;

    const responses = await prisma.formResponses.findMany({
      where: {
        form: { organizationId: orgId },
        ...(q
          ? {
              OR: [
                { form: { name: { contains: q, mode: "insensitive" } } },
                { lead: { name: { contains: q, mode: "insensitive" } } },
                { label: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      select: {
        id: true,
        createdAt: true,
        label: true,
        form: {
          select: {
            id: true,
            name: true,
            jsonBlock: true,
            settings: {
              select: {
                backgroundColor: true,
                backgroundImage: true,
                primaryColor: true,
              },
            },
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
            status: { select: { id: true, name: true, color: true } },
            tracking: { select: { id: true, name: true } },
            responsible: { select: { id: true, name: true, image: true } },
          },
        },
      },
    });

    return { responses };
  });
