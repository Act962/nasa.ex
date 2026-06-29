import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Retorna as preferências de chat do usuário logado. Se nunca configurou,
 * retorna defaults (`chatBackgroundType: "default"` + cores nulas → UI
 * usa palette WhatsApp-like).
 */
export const getUserChatPreferences = base
  .use(requiredAuthMiddleware)
  .input(z.void())
  .output(
    z.object({
      chatBackgroundType: z.enum(["default", "color", "image"]),
      chatBackgroundValue: z.string().nullable(),
      chatBackgroundOpacity: z.number().min(0).max(100),
      ownMessageBgColor: z.string().nullable(),
      theirMessageBgColor: z.string().nullable(),
    }),
  )
  .handler(async ({ context }) => {
    const userId = context.user.id;

    const prefs = await prisma.userChatPreferences.findUnique({
      where: { userId },
      select: {
        chatBackgroundType: true,
        chatBackgroundValue: true,
        chatBackgroundOpacity: true,
        ownMessageBgColor: true,
        theirMessageBgColor: true,
      },
    });

    return {
      chatBackgroundType:
        (prefs?.chatBackgroundType as "default" | "color" | "image") ??
        "default",
      chatBackgroundValue: prefs?.chatBackgroundValue ?? null,
      chatBackgroundOpacity: prefs?.chatBackgroundOpacity ?? 100,
      ownMessageBgColor: prefs?.ownMessageBgColor ?? null,
      theirMessageBgColor: prefs?.theirMessageBgColor ?? null,
    };
  });
