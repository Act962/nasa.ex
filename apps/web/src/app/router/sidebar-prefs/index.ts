import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getSidebarPrefs = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", summary: "Get sidebar preferences" })
  .input(z.object({}))
  .output(z.record(z.string(), z.boolean()))
  .handler(async ({ context }) => {
    const prefs = await prisma.userSidebarPreference.findMany({
      where: { userId: context.user.id },
      select: { itemKey: true, visible: true },
    });
    const map: Record<string, boolean> = {};
    for (const p of prefs) map[p.itemKey] = p.visible;
    return map;
  });

export const setSidebarPref = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Set sidebar preference" })
  .input(z.object({
    itemKey: z.string(),
    visible: z.boolean(),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    await prisma.userSidebarPreference.upsert({
      where: { userId_itemKey: { userId: context.user.id, itemKey: input.itemKey } },
      create: { userId: context.user.id, itemKey: input.itemKey, visible: input.visible },
      update: { visible: input.visible },
    });
    return { success: true };
  });

export const sidebarPrefsRouter = { get: getSidebarPrefs, set: setSidebarPref };
