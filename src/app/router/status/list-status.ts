import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listStatus = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/list-status-with-leads",
    summary: "List all status",
    tags: ["Status"],
  })
  .input(
    z.object({
      trackingId: z.string(),
      participant: z.string().optional(),
      tags: z.string().optional(),
      date_init: z.date().optional(),
      date_end: z.date().optional(),
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
              tags: z.array(z.string()),
            })
          ),
        })
      ),
    })
  )
  .handler(async ({ input }) => {
    const status = await prisma.status.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        order: true,
        trackingId: true,
        leads: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            statusId: true,
            order: true,
            leadTags: {
              select: {
                tag: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            order: "asc",
          },
          where: {
            currentAction: "ACTIVE",
            ...(input.date_init &&
              input.date_end && {
                createdAt: {
                  gte: input.date_init,
                  lte: input.date_end,
                },
              }),
          },
        },
      },
      where: {
        trackingId: input.trackingId,
      },
      orderBy: {
        order: "asc",
      },
    });

    // Transforme os dados para o formato desejado
    const formattedStatus = status.map((s) => ({
      ...s,
      leads: s.leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        statusId: lead.statusId,
        order: lead.order,
        tags: lead.leadTags.map((lt) => lt.tag.name),
      })),
    }));

    return {
      status: formattedStatus,
    };
  });
