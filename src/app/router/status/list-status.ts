import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listStatus = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List all status",
    tags: ["Status"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      status: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          color: z.string().nullable(),
          order: z.number(),
          trackingId: z.string(),
          leads: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              email: z.string().nullable(),
              order: z.number(),
              phone: z.string().nullable(),
              statusId: z.string(),
            })
          ),
        })
      ),
    })
  )
  .handler(async ({ input }) => {
    const status = await prisma.status.findMany({
      where: {
        trackingId: input.trackingId,
      },
      orderBy: {
        order: "asc",
      },
      include: {
        leads: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            statusId: true,
            order: true,
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    return {
      status: status,
    };
  });
