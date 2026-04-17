import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listScripts = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/scripts" })
  .input(z.object({ trackingId: z.string() }))
  .handler(async ({ input }) => {
    const scripts = await prisma.script.findMany({
      where: { trackingId: input.trackingId },
      orderBy: { createdAt: "asc" },
    });
    return scripts;
  });
