import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getTagByLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "Get tag by lead",
    tags: ["Tags"],
  })
  .input(
    z.object({
      leadId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const lead = await prisma.lead.findUnique({
      where: {
        id: input.leadId,
      },
      select: {
        id: true,
        leadTags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!lead) {
      throw errors.BAD_REQUEST({
        message: "Lead não encontrado",
      });
    }

    const tags = lead.leadTags.map((leadTag) => leadTag.tag);

    return {
      leadId: lead.id,
      tags,
    };
  });
