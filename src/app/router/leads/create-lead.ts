import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";

// 🟧 LIST ALL
export const createLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a new lead",
    tags: ["Leads"],
  })
  .input(
    z.object({
      name: z.string(),
      phone: z.string(),
      email: z.string().optional(),
      description: z.string().optional(),
      statusId: z.string(),
      trackingId: z.string(),
    }),
  )
  .output(
    z.object({
      lead: z.object({
        id: z.string(),
        name: z.string(),
        phone: z.string().nullable(),
        email: z.string().nullable(),
        description: z.string().nullable(),
        statusId: z.string(),
        trackingId: z.string(),
        // order: z.string(),
        createdAt: z.date(),
      }),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const lead = await prisma.$transaction(async (tx) => {
        const existingLead = await tx.lead.findUnique({
          where: {
            phone_trackingId: {
              phone: input.phone,
              trackingId: input.trackingId,
            },
          },
        });

        if (existingLead) {
          return existingLead;
        }

        const lastLead = await tx.lead.findFirst({
          where: {
            statusId: input.statusId,
            trackingId: input.trackingId,
          },
          orderBy: { order: "desc" },
          select: { order: true },
        });

        let newOrder: Decimal;

        newOrder = lastLead
          ? new Decimal(lastLead.order).plus(1)
          : new Decimal(0);

        // const newOrder = lastLead !== null ? lastLead.order + 1 : 0;

        // Cria o novo lead
        return await tx.lead.create({
          data: {
            name: input.name,
            phone: input.phone,
            email: input.email,
            description: input.description,
            statusId: input.statusId,
            trackingId: input.trackingId,
            order: newOrder,
            responsibleId: context.user.id,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            description: true,
            statusId: true,
            trackingId: true,
            // order: true,
            createdAt: true,
          },
        });
      });

      return { lead };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
