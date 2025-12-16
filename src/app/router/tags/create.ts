import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireOrgMiddleware } from "@/app/middlewares/org";

export const createTag = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
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
    const tag = await prisma.tag.create({
      data: {
        name: input.name,
        color: input.color,
        organizationId: context.org.id,
        trackingId: input.trackingId,
      },
    });

    return {
      tag,
    };
  });
