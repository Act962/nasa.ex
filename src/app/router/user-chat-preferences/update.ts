import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

// Hex color #RGB ou #RRGGBB — usado pra validar fundo + cores das bolhas
const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Cor inválida (use formato #RRGGBB)");

/**
 * Atualiza (ou cria via upsert) as preferências de chat do usuário logado.
 * Todos os campos são opcionais — passa só o que quer mudar.
 */
export const updateUserChatPreferences = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      chatBackgroundType: z.enum(["default", "color", "image"]).optional(),
      /** Quando type=color → hex. Quando type=image → URL. Null pra resetar. */
      chatBackgroundValue: z.string().nullable().optional(),
      /** Opacidade da imagem 0-100. Default 100 (opaca). */
      chatBackgroundOpacity: z.number().int().min(0).max(100).optional(),
      ownMessageBgColor: hexColor.nullable().optional(),
      theirMessageBgColor: hexColor.nullable().optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const userId = context.user.id;

    // Upsert — cria se não existe, atualiza se existe. Mantém defaults
    // pros campos não passados (undefined no Prisma = "não altera").
    await prisma.userChatPreferences.upsert({
      where: { userId },
      create: {
        userId,
        chatBackgroundType: input.chatBackgroundType ?? "default",
        chatBackgroundValue: input.chatBackgroundValue ?? null,
        chatBackgroundOpacity: input.chatBackgroundOpacity ?? 100,
        ownMessageBgColor: input.ownMessageBgColor ?? null,
        theirMessageBgColor: input.theirMessageBgColor ?? null,
      },
      update: {
        ...(input.chatBackgroundType !== undefined && {
          chatBackgroundType: input.chatBackgroundType,
        }),
        ...(input.chatBackgroundValue !== undefined && {
          chatBackgroundValue: input.chatBackgroundValue,
        }),
        ...(input.chatBackgroundOpacity !== undefined && {
          chatBackgroundOpacity: input.chatBackgroundOpacity,
        }),
        ...(input.ownMessageBgColor !== undefined && {
          ownMessageBgColor: input.ownMessageBgColor,
        }),
        ...(input.theirMessageBgColor !== undefined && {
          theirMessageBgColor: input.theirMessageBgColor,
        }),
      },
    });

    return { ok: true };
  });
