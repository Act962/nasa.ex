import { meterOrThrow } from "@/features/stars/lib/metering";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireStarsMiddleware } from "@/app/middlewares/require-stars";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { StarTransactionType } from "@/generated/prisma/enums";
import {
  selectImageProvider, generateImage, STARS_IMAGE_STANDARD, STARS_IMAGE_HD, STARS_IMAGE_POLLINATIONS,
} from "./_helpers/ai-provider";
import {
  buildBrandedContext,
  appendBrandToImagePrompt,
} from "@/features/nasa-planner/lib/brand-context";

export const generateImageFromPrompt = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireStarsMiddleware)
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

    // Variante do catálogo: mesma lógica que as constantes STARS_IMAGE_*
    // codificavam, agora resolvida por nome em vez de número no código.
    const imageVariant =
      providerInfo.provider === "pollinations"
        ? "pollinations"
        : input.quality === "hd"
          ? "hd"
          : "standard";

    const debit = await meterOrThrow({
      organizationId: context.org.id,
      action: "planner_image_prompt",
      variant: imageVariant,
      userId: context.user.id,
      appSlug: "nasa-planner",
      description: `ÓRBITA Planner — geração de imagem (${providerInfo.provider})`,
      feature: "planner.image.prompt",
      quantity: { unit: "image", amount: 1 },
      cost: { kind: "IMAGE", provider: providerInfo.provider },
    }, "Saldo de stars insuficiente");

    // Brand context: injeta paleta + fonte + posicionamento + slogan no
    // final do prompt do usuário pra IA respeitar a identidade da marca.
    // Sem brand kit configurado, `brandedPrompt === input.prompt`.
    const brandCtx = await buildBrandedContext(context.org.id);
    const brandedPrompt = appendBrandToImagePrompt(input.prompt, brandCtx);

    const imageKey = await generateImage(brandedPrompt, providerInfo, input.quality);
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
      data: { thumbnail: imageKey, starsSpent: { increment: debit.stars } },
    });

    return { imageKey, starsSpent: debit.stars, balanceAfter: debit.balanceAfter, provider: providerInfo.provider };
  });
