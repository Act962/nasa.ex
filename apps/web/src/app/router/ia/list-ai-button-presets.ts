import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const listAiButtonPresets = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const { trackingId } = input;

    const presets = await prisma.aiButtonPreset.findMany({
      where: { trackingId },
      orderBy: { createdAt: "asc" },
    });

    return { presets };
  });
