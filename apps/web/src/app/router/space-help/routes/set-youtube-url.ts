import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireModerator } from "../utils";

const VIDEO_REGEX = /^(https?:\/\/)?(www\.|player\.)?(youtube\.com|youtu\.be|vimeo\.com)\/.+/i;

export const setYoutubeUrl = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      target: z.enum(["feature", "lesson"]),
      id: z.string(),
      youtubeUrl: z
        .string()
        .refine(
          (v) => v === "" || VIDEO_REGEX.test(v),
          "URL inválida — use YouTube ou Vimeo",
        )
        .nullable()
        .or(z.literal("")),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireModerator(context.user.id);
    const value = input.youtubeUrl && input.youtubeUrl.length > 0 ? input.youtubeUrl : null;
    if (input.target === "feature") {
      await prisma.spaceHelpFeature.update({
        where: { id: input.id },
        data: { youtubeUrl: value, updatedById: context.user.id },
      });
    } else {
      await prisma.spaceHelpLesson.update({
        where: { id: input.id },
        data: { youtubeUrl: value },
      });
    }
    return { success: true, youtubeUrl: value };
  });
