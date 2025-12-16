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
    })
  )
  .output(
    z.object({
      lead: z.object({
        // Campos do lead
        id: z.string(),
        name: z.string(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        description: z.string().nullable(),
        statusId: z.string(),
        order: z.number(),
        trackingId: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),

        // Relacionamento status
        status: z.object({
          id: z.string(),
          name: z.string(),
          trackingId: z.string(),
          order: z.number(),
          color: z.string().nullable(),
          createdAt: z.date(),
          updatedAt: z.date(),
        }),

        // Relacionamento tracking
        tracking: z.object({
          id: z.string(),
          name: z.string(),
          organizationId: z.string(),
          description: z.string().nullable(),
          createdAt: z.date(),
          updatedAt: z.date(),
        }),
      }),
    })
  )
  .handler(async ({ input, errors }) => {
    try {
      const lead = await prisma.lead.findUnique({
        where: {
          id: input.id,
        },
        include: {
          tracking: true,
          status: true,
        },
      });

      if (!lead) {
        throw errors.NOT_FOUND;
      }

      return { lead };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
