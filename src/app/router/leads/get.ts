import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// 🟨 GET
export const getLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "Retrieve a lead by ID or by phone + trackingId",
    tags: ["Leads"],
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )

  .handler(async ({ input, context, errors }) => {
    try {
      const _lead = await prisma.lead.findUnique({
        where: {
          id: input.id,
        },
        select: {
          id: true,
          name: true,
          nickname: true,
          publicToken: true,
          addressZipCode: true,
          addressStreet: true,
          addressNumber: true,
          addressComplement: true,
          addressNeighborhood: true,
          addressCity: true,
          addressState: true,
          addressCountry: true,
          lastInboundAt: true,
          lastOutboundAt: true,
          statusFlow: true,
          metrics: true,
          email: true,
          phone: true,
          description: true,
          profile: true,
          statusId: true,
          trackingId: true,
          orgProjectId: true,
          amount: true,
          temperature: true,
          createdAt: true,
          updatedAt: true,
          responsible: {
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
              updatedAt: true,
              emailVerified: true,
              image: true,
            },
          },
          status: {
            select: {
              id: true,
              name: true,
              trackingId: true,
              order: true,
              color: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          tracking: {
            select: {
              id: true,
              name: true,
              organizationId: true,
              description: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          leadTags: {
            select: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
          conversation: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!_lead) {
        throw errors.NOT_FOUND({ message: "Lead não encontrado" });
      }

      // Lead de outra empresa responde como inexistente: sem esta conferência,
      // qualquer usuário logado lia os dados de um lead pelo id.
      const membership = await prisma.member.findFirst({
        where: { organizationId: _lead.tracking.organizationId, userId: context.user.id },
        select: { id: true },
      });
      if (!membership) {
        throw errors.NOT_FOUND({ message: "Lead não encontrado" });
      }

      const lead = {
        ..._lead,
        status: {
          ..._lead.status,
          order: _lead.status.order.toString(),
        },
        amount: Number(_lead.amount),
        tags: _lead.leadTags.map((leadTag) => leadTag.tag),
      };

      return { lead };
    } catch (err) {
      if ((err as { code?: string } | null)?.code === "NOT_FOUND") throw err;
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
