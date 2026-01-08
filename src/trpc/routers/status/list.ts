import { FILTERS } from "@/config/constants";
import prisma from "@/lib/prisma";
import { protectedProcedure } from "@/trpc/init";
import z from "zod";

export const listStatus = protectedProcedure
  .input(
    z.object({
      trackingId: z.string(),
      participant: z.string().optional(),
      tags: z.array(z.string()).optional(),
      date_init: z.coerce.date().default(FILTERS.INIT_DATE),
      date_end: z.coerce.date().default(FILTERS.END_DATE),
    })
  )
  .query(async ({ ctx, input }) => {
    console.log("📥 Input:", input);

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
            createdAt: true,
            responsible: {
              select: {
                email: true,
                name: true,
                image: true,
              },
            },
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
            createdAt: {
              gte: input.date_init,
              lte: input.date_end,
            },
            ...(input.participant && {
              responsible: {
                email: input.participant,
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

    console.log("📊 Raw data:", JSON.stringify(status, null, 2));

    // Mapeie para o formato final de forma explícita
    const formattedStatus = status.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      order: s.order,
      trackingId: s.trackingId,
      leads: s.leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        statusId: lead.statusId,
        order: lead.order,
        createdAt: lead.createdAt, // Deixe como Date
        responsible: lead.responsible,
        tags: lead.leadTags.map((lt) => lt.tag.name),
      })),
    }));

    console.log("✅ Formatted data:", JSON.stringify(formattedStatus, null, 2));

    return { status: formattedStatus };
  });
