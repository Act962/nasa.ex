import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

const AlertConfigSchema = z.object({
  alertAt20: z.boolean().default(true),
  alertAt10: z.boolean().default(true),
  alertAt5: z.boolean().default(true),
  notifyByEmail: z.boolean().default(true),
});

export const updateStarAlertConfig = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(AlertConfigSchema)
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    await prisma.organization.update({
      where: { id: context.org.id },
      data: { starsAlertConfig: input },
    });
    return { success: true };
  });
