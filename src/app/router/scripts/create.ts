import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createScript = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", path: "/scripts" })
  .input(
    z.object({
      name: z.string().trim().min(1),
      content: z.string(),
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const script = await prisma.script.create({
      data: {
        name: input.name,
        content: input.content,
        trackingId: input.trackingId,
      },
    });
    return script;
  });
