import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { debitStars } from "@/lib/star-service";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { StarTransactionType } from "@/generated/prisma/enums";
import {
  selectImageProvider, generateImage, STARS_IMAGE_STANDARD, STARS_IMAGE_HD, STARS_IMAGE_POLLINATIONS,
} from "./_helpers/ai-provider";

export const generateImageFromPrompt = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      postId: z.string(),
      prompt: z.string().min(1),
      quality: z.enum(["standard", "hd"]).default("standard"),
    }),
  )
  .handler(async ({ input, context }) => {
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
    });
    if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });

    const providerInfo = await selectImageProvider(context.org.id);

    const starsToDebit =
      providerInfo.provider === "pollinations"
        ? STARS_IMAGE_POLLINATIONS
        : input.quality === "hd"
          ? STARS_IMAGE_HD
          : STARS_IMAGE_STANDARD;

    const debit = await debitStars(
      context.org.id, starsToDebit, StarTransactionType.APP_CHARGE,
      `NASA Planner — geração de imagem (${providerInfo.provider})`, "nasa-planner", context.user.id,
    );
    if (!debit.success) throw new ORPCError("BAD_REQUEST", { message: "Saldo de stars insuficiente" });

    const imageKey = await generateImage(input.prompt, providerInfo, input.quality);
    if (!imageKey) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Falha ao gerar imagem. Tente novamente." });
    }

    // Upsert first slide
    const existingSlide = await prisma.nasaPlannerPostSlide.findFirst({
      where: { postId: post.id, order: 1 },
    });

    if (existingSlide) {
      await prisma.nasaPlannerPostSlide.update({
        where: { id: existingSlide.id },
        data: { imageKey },
      });
    } else {
      await prisma.nasaPlannerPostSlide.create({
        data: { postId: post.id, order: 1, imageKey, overlayConfig: {} },
      });
    }

    await prisma.nasaPlannerPost.update({
      where: { id: post.id },
      data: { thumbnail: imageKey, starsSpent: { increment: starsToDebit } },
    });

    return { imageKey, starsSpent: starsToDebit, balanceAfter: debit.newBalance, provider: providerInfo.provider };
  });
