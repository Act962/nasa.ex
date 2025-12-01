import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listTags = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/tags",
  })
  .input(
    z.object({
      query: z
        .object({
          trackingId: z.string().optional(),
        })
        .optional(),
    })
  )
  .output(
    z.object({
      tags: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          color: z.string().nullable().default("#1447e6"),
        })
      ),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const { org } = context;

    if (!org) {
      throw errors.BAD_REQUEST;
    }

    const tags = await prisma.tag.findMany({
      select: {
        id: true,
        name: true,
        color: true,
      },
      where: {
        organizationId: org.id,
        trackingId: input.query?.trackingId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      tags,
    };
  });
