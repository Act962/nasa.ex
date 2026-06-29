import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { debitStars } from "@/features/stars/lib/star-service";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { StarTransactionType } from "@/generated/prisma/enums";
import {
  selectImageProvider,
  generateImage,
} from "./_helpers/ai-provider";
import {
  generateImageViaIdeogram,
  resolveIdeogramApiKey,
} from "@/lib/ai/ideogram-client";
import {
  buildBrandedContext,
  appendBrandToImagePrompt,
} from "@/features/nasa-planner/lib/brand-context";

/**
 * Geração de imagem do PlannerPopup com **seleção de modelo IA** —
 * NASA Planner 2.0. Usuário escolhe no UI qual modelo quer usar:
 *
 *  - `ideogram_quality`   → Ideogram 3.0 QUALITY (6★) — recomendado pra
 *    cards com TIPOGRAFIA legível (estilo Dra. Thaine: título grande na
 *    arte + footer com handle). DALL-E embaralha letras, Ideogram não.
 *  - `ideogram_balanced`  → Ideogram 3.0 BALANCED (4★) — padrão; bom
 *    custo-benefício pra rascunhos.
 *  - `ideogram_turbo`     → Ideogram 3.0 TURBO (3★) — rápido, qualidade
 *    boa pra brainstorming.
 *  - `dalle3_hd`          → DALL-E 3 HD (5★) — bom pra fotos/cenas
 *    realistas, ruim pra tipografia.
 *  - `dalle3_standard`    → DALL-E 3 Standard (3★) — fallback OK.
 *  - `pollinations`       → Pollinations free (1★) — gratuito, qualidade
 *    inconsistente. Sempre disponível como último recurso.
 *
 * Brand context (`buildBrandedContext`) é injetado AUTOMATICAMENTE no
 * prompt — paleta, fontes, slogan, posicionamento — pra todo modelo
 * respeitar a identidade visual da marca.
 *
 * NÃO suporta imagem de referência (img2img) — pra isso use
 * `generate-image-from-reference.ts` (Replicate SDXL). A imagem de
 * referência do PlannerPopup é usada apenas como CONTEXTO no prompt
 * descritivo (URL aparece como referência no texto, IA olha durante a
 * geração).
 */

const MODEL_OPTIONS = [
  "ideogram_quality",
  "ideogram_balanced",
  "ideogram_turbo",
  "dalle3_hd",
  "dalle3_standard",
  "pollinations",
] as const;

const ASPECT_RATIO_OPTIONS = ["1x1", "9x16", "16x9", "4x5", "5x4"] as const;

const MODEL_TO_STARS: Record<(typeof MODEL_OPTIONS)[number], number> = {
  ideogram_quality: 6,
  ideogram_balanced: 4,
  ideogram_turbo: 3,
  dalle3_hd: 5,
  dalle3_standard: 3,
  pollinations: 1,
};

const MODEL_TO_LABEL: Record<(typeof MODEL_OPTIONS)[number], string> = {
  ideogram_quality: "Ideogram 3.0 Quality",
  ideogram_balanced: "Ideogram 3.0 Balanced",
  ideogram_turbo: "Ideogram 3.0 Turbo",
  dalle3_hd: "DALL-E 3 HD",
  dalle3_standard: "DALL-E 3 Standard",
  pollinations: "Pollinations (gratuito)",
};

export const generatePostImage = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/nasa-planner/posts/generate-image",
    summary: "Generate image for a post with explicit model selection",
    tags: ["NASA Planner"],
  })
  .input(
    z.object({
      postId: z.string(),
      prompt: z.string().min(5).max(2000),
      model: z.enum(MODEL_OPTIONS).default("ideogram_balanced"),
      aspectRatio: z.enum(ASPECT_RATIO_OPTIONS).default("1x1"),
      /**
       * Quando o usuário sobe ou cola URL de uma imagem de REFERÊNCIA
       * (estilo, cor, composição), incluímos uma menção no prompt.
       * Não é img2img — é só guidance textual. Pra img2img real, usar
       * `generate-image-from-reference.ts`.
       */
      referenceImageUrl: z.string().url().optional(),
      negativePrompt: z.string().max(500).optional(),
      slideOrder: z.number().int().default(1),
    }),
  )
  .output(
    z.object({
      imageKey: z.string(),
      modelUsed: z.string(),
      starsSpent: z.number().int(),
      balanceAfter: z.number().int(),
      brandApplied: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
    });
    if (!post) {
      throw errors.NOT_FOUND({ message: "Post não encontrado" });
    }

    // ── 1. Brand context (mesmo padrão da sprint foundation) ───────────
    const brandCtx = await buildBrandedContext(context.org.id);
    let finalPrompt = appendBrandToImagePrompt(input.prompt, brandCtx);

    // Referência textual — não é img2img, mas dá guidance ao modelo
    if (input.referenceImageUrl) {
      finalPrompt =
        `${finalPrompt}\n\nReference image for style/composition: ${input.referenceImageUrl}`;
    }

    // ── 2. Cobrança upfront ────────────────────────────────────────────
    const starsToDebit = MODEL_TO_STARS[input.model];
    const debit = await debitStars(
      context.org.id,
      starsToDebit,
      StarTransactionType.APP_CHARGE,
      `NASA Planner — imagem ${MODEL_TO_LABEL[input.model]}`,
      "nasa-planner",
      context.user.id,
    );
    if (!debit.success) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Saldo de STARs insuficiente (${starsToDebit}★ necessários).`,
      });
    }

    // ── 3. Dispatch pro provider correto ───────────────────────────────
    let imageKey: string | null = null;
    let modelUsed = MODEL_TO_LABEL[input.model];

    try {
      if (input.model.startsWith("ideogram_")) {
        const ideogramKey = await resolveIdeogramApiKey(context.org.id);
        if (!ideogramKey) {
          // Sem key — degrada pra DALL-E/Pollinations
          console.warn(
            "[nasa-planner.generatePostImage] IDEOGRAM_API_KEY not configured, falling back to provider hierarchy",
          );
          const providerInfo = await selectImageProvider(context.org.id);
          imageKey = await generateImage(
            finalPrompt,
            providerInfo,
            input.model === "ideogram_quality" ? "hd" : "standard",
          );
          modelUsed = `${providerInfo.provider} (fallback — Ideogram não configurado)`;
        } else {
          const rendering =
            input.model === "ideogram_quality"
              ? "QUALITY"
              : input.model === "ideogram_turbo"
                ? "TURBO"
                : "BALANCED";
          imageKey = await generateImageViaIdeogram({
            prompt: finalPrompt,
            apiKey: ideogramKey,
            rendering,
            aspectRatio: input.aspectRatio,
            styleType: "DESIGN", // tipografia melhor que AUTO pra cards
            negativePrompt: input.negativePrompt,
          });
        }
      } else if (input.model === "dalle3_hd" || input.model === "dalle3_standard") {
        const providerInfo = await selectImageProvider(context.org.id);
        if (providerInfo.provider !== "dalle3") {
          throw new ORPCError("PRECONDITION_FAILED", {
            message:
              "DALL-E 3 não está configurado. Conecte a integração OpenAI ou escolha outro modelo.",
          });
        }
        imageKey = await generateImage(
          finalPrompt,
          providerInfo,
          input.model === "dalle3_hd" ? "hd" : "standard",
        );
      } else {
        // pollinations
        imageKey = await generateImage(
          finalPrompt,
          { provider: "pollinations", apiKey: null },
          "standard",
        );
      }
    } catch (err) {
      console.error("[nasa-planner.generatePostImage] generation failed", err);
      throw errors.INTERNAL_SERVER_ERROR({
        message: `Falha ao gerar imagem via ${MODEL_TO_LABEL[input.model]}. Tente outro modelo ou aguarde alguns minutos.`,
      });
    }

    if (!imageKey) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Provider retornou imagem vazia. Tente outro modelo.",
      });
    }

    // ── 4. Upsert slide + thumbnail ────────────────────────────────────
    const existingSlide = await prisma.nasaPlannerPostSlide.findFirst({
      where: { postId: post.id, order: input.slideOrder },
    });
    if (existingSlide) {
      await prisma.nasaPlannerPostSlide.update({
        where: { id: existingSlide.id },
        data: { imageKey },
      });
    } else {
      await prisma.nasaPlannerPostSlide.create({
        data: {
          postId: post.id,
          order: input.slideOrder,
          imageKey,
          overlayConfig: {},
        },
      });
    }

    if (input.slideOrder === 1) {
      await prisma.nasaPlannerPost.update({
        where: { id: post.id },
        data: {
          thumbnail: imageKey,
          starsSpent: { increment: starsToDebit },
          aiPrompt: input.prompt, // salva o prompt original (sem brand suffix)
        },
      });
    }

    return {
      imageKey,
      modelUsed,
      starsSpent: starsToDebit,
      balanceAfter: debit.newBalance,
      brandApplied: brandCtx.kitComplete,
    };
  });
