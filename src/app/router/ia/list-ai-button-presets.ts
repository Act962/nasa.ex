import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { canAccessTrackingMenus } from "./button-preset-access";
import z from "zod";

export const listAiButtonPresets = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { trackingId } = input;
    // Funil de outra empresa responde como funil sem menus.
    if (!(await canAccessTrackingMenus(trackingId, context.user.id))) return { presets: [] };

    const presets = await prisma.aiButtonPreset.findMany({
      where: { trackingId },
      orderBy: { createdAt: "asc" },
    });

    return { presets };
  });
