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

  .handler(async ({ input, errors }) => {
    try {
      const _lead = await prisma.lead.findUnique({
        where: {
          id: input.id,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          description: true,
          profile: true,
          statusId: true,
          trackingId: true,
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
        },
      });

      if (!_lead) {
        throw errors.NOT_FOUND;
      }

      const lead = {
        ..._lead,
        status: {
          ..._lead.status,
          order: _lead.status.order.toString(),
        },
      };

      return { lead };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
