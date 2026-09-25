import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { requireOrgMiddleware } from "../../middlewares/org";

export const listLead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/leads",
    summary: "Get all leads",
  })
  // Filtros do cabeçalho de /contatos. Todos opcionais: sem eles a procedure
  // responde como sempre respondeu.
  .input(
    z
      .object({
        trackingId: z.string().optional(),
        tagIds: z.array(z.string()).optional(),
        dateField: z.enum(["createdAt", "lastInboundAt"]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        segment: z.enum(["novos", "campeoes", "leais", "risco"]).optional(),
      })
      .optional(),
  )
  .handler(async ({ errors, context, input }) => {
    try {
      const { org, user } = context;
      const { buildSegmentWhere, buildScopeWhere, loyalLeadIds } = await import(
        "./segment-rules"
      );
      const scope = {
        tracking: {
          organizationId: org.id,
          participants: { some: { userId: user.id } },
        },
      };
      // "Leal" não cabe em `where`: resolve os ids com a mesma função que o
      // card usa, para a lista mostrar exatamente o que o número prometeu.
      const loyalFilter =
        input?.segment === "leais"
          ? {
              id: {
                in: await loyalLeadIds(prisma, {
                  ...scope,
                  ...buildScopeWhere(input),
                }),
              },
            }
          : {};

      const leads = await prisma.lead.findMany({
        where: {
          ...scope,
          ...buildSegmentWhere(input),
          ...loyalFilter,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          createdAt: true,
          profile: true,
          // isArchived alimenta o badge "Arquivado" + a opção
          // "Desarquivar" no menu de actions da tabela /contatos.
          isArchived: true,
          tracking: {
            select: {
              id: true,
              name: true,
            },
          },
          status: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return {
        leads,
      };
    } catch (error) {
      console.log(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
