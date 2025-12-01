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
      body: z.object({
        name: z.string(),
        color: z.string().nullable().default("#1447e6"),
        trackingId: z.string().nullable().default(null),
      }),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const { org } = context;

    if (!org) {
      throw errors.BAD_REQUEST;
    }

    const tag = await prisma.tag.create({
      data: {
        name: input.body.name,
        color: input.body.color,
        organizationId: org.id,
        trackingId: input.body.trackingId,
      },
    });

    return {
      tag,
    };
  });
