import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const PrefSchema = z.object({
  notifType: z.string(),
  inApp:     z.boolean(),
  whatsApp:  z.boolean(),
});

export const getNotificationPreferences = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", summary: "Get notification preferences" })
  .input(z.object({ organizationId: z.string() }))
  .output(z.array(PrefSchema))
  .handler(async ({ input, context }) => {
    const prefs = await prisma.userNotificationPreference.findMany({
      where: { userId: context.user.id, organizationId: input.organizationId },
      select: { notifType: true, inApp: true, whatsApp: true },
    });
    return prefs;
  });

export const setNotificationPreference = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Set notification preference" })
  .input(z.object({
    organizationId: z.string(),
    notifType:      z.string(),
    inApp:          z.boolean(),
    whatsApp:       z.boolean(),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    await prisma.userNotificationPreference.upsert({
      where: {
        userId_organizationId_notifType: {
          userId:         context.user.id,
          organizationId: input.organizationId,
          notifType:      input.notifType,
        },
      },
      create: {
        userId:         context.user.id,
        organizationId: input.organizationId,
        notifType:      input.notifType,
        inApp:          input.inApp,
        whatsApp:       input.whatsApp,
      },
      update: {
        inApp:    input.inApp,
        whatsApp: input.whatsApp,
      },
    });
    return { success: true };
  });
