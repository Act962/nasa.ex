import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireModerator } from "../utils";

export const setStepScreenshot = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      stepId: z.string().min(1),
      screenshotUrl: z.string().url().nullable().or(z.literal("")),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireModerator(context.user.id);
    const value =
      input.screenshotUrl && input.screenshotUrl.length > 0
        ? input.screenshotUrl
        : null;

    await prisma.spaceHelpStep.update({
      where: { id: input.stepId },
      data: { screenshotUrl: value },
    });

    return { success: true, screenshotUrl: value };
  });
