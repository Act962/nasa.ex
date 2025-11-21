import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../auth";
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
    z
      .object({
        id: z.string().optional(),
        phone: z.string().optional(),
        trackingId: z.string().optional(),
      })
      .refine(
        (data) => data.id || (data.phone && data.trackingId),
        "You must provide either 'id' or both 'phone' and 'trackingId'."
      )
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
        order: z.number(),
        trackingId: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
      }),
    })
  )
  .handler(async ({ input, errors }) => {
    try {
      let lead = null;

      if (input.id) {
        lead = await prisma.lead.findUnique({
          where: { id: input.id },
        });
      } else if (input.phone && input.trackingId) {
        lead = await prisma.lead.findUnique({
          where: {
            phone_trackingId: {
              phone: input.phone,
              trackingId: input.trackingId,
            },
          },
        });
      }

      if (!lead) {
        throw errors.NOT_FOUND;
      }

      return { lead };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
