import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createTag = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/tags",
  })
  .input(
    z.object({
      name: z.string().trim().min(2),
      color: z.string().nullable().default("#1447e6"),
      trackingId: z.string().nullable().default(null),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const { org } = context;

    if (!org) {
      throw errors.BAD_REQUEST;
    }

    const tag = await prisma.tag.create({
      data: {
        name: input.name,
        color: input.color,
        organizationId: org.id,
        trackingId: input.trackingId,
      },
    });

    return {
      tag,
    };
  });
