import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { debitStars } from "@/lib/star-service";
import { z } from "zod";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ORPCError } from "@orpc/server";
import { NasaPostType, NasaPostStatus, StarTransactionType } from "@/generated/prisma/enums";

const STARS_PER_GENERATION = 5;

export const generatePost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      postId: z.string(),
      userPrompt: z.string().min(1),
      networks: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const post = await prisma.nasaPost.findFirst({
        where: { id: input.postId, organizationId: context.org.id },
        include: { slides: true },
      });
      if (!post) {
        throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });
      }

      const brand = await prisma.nasaPostBrandConfig.findUnique({
        where: { organizationId: context.org.id },
      });

      // Resolve Anthropic API key: org key takes priority, fallback to env var
      const anthropicApiKey = brand?.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;
      console.log("[NASA Post] generate | key present:", !!anthropicApiKey, "| brand:", !!brand);

      if (!anthropicApiKey) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "Chave da API Anthropic não configurada. Acesse Configurações da Marca → aba IA e insira sua chave.",
        });
      }

      const anthropic = createAnthropic({ apiKey: anthropicApiKey });

      // Debit stars
      let debit: { success: boolean; newBalance: number };
      try {
        debit = await debitStars(
          context.org.id,
          STARS_PER_GENERATION,
          StarTransactionType.APP_CHARGE,
          `NASA Post — geração de conteúdo IA`,
          "nasa-post",
        );
      } catch (starErr: any) {
        console.error("[NASA Post] debitStars error:", starErr?.message);
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: `Erro ao debitar stars: ${starErr?.message ?? "tente novamente"}`,
        });
      }
      if (!debit.success) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Saldo de stars insuficiente para gerar o post",
        });
      }

    // Build brand context
    const swot = brand?.swot as Record<string, string> | null;
    const fonts = brand?.fonts as Record<string, string> | null;
    const brandContext = brand
      ? [
          `Marca: ${brand.brandName}`,
          brand.brandSlogan ? `Slogan: ${brand.brandSlogan}` : "",
          brand.icp ? `Público-alvo (ICP): ${brand.icp}` : "",
          brand.positioning ? `Posicionamento: ${brand.positioning}` : "",
          brand.toneOfVoice ? `Tom de voz: ${brand.toneOfVoice}` : "",
          brand.keyMessages?.length
            ? `Mensagens-chave: ${brand.keyMessages.join(", ")}`
            : "",
          brand.forbiddenWords?.length
            ? `Palavras proibidas: ${brand.forbiddenWords.join(", ")}`
            : "",
          brand.primaryColors?.length
            ? `Cores primárias: ${brand.primaryColors.join(", ")}`
            : "",
          fonts?.heading ? `Tipografia principal: ${fonts.heading}` : "",
          brand.defaultHashtags?.length
            ? `Hashtags padrão: ${brand.defaultHashtags.join(" ")}`
            : "",
          brand.defaultCtas?.length
            ? `CTAs padrão: ${brand.defaultCtas.join(" | ")}`
            : "",
          swot?.strengths ? `Forças (SWOT): ${swot.strengths}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "Nenhuma configuração de marca encontrada.";

    const postTypeLabel =
      post.type === NasaPostType.CAROUSEL
        ? "carrossel (múltiplos slides)"
        : post.type === NasaPostType.REEL
          ? "reel/vídeo"
          : post.type === NasaPostType.STORY
            ? "story"
            : "post estático";

    const networkContext =
      (input.networks ?? post.targetNetworks).length > 0
        ? `Redes sociais alvo: ${(input.networks ?? post.targetNetworks).join(", ")}`
        : "";

    const systemPrompt = `Você é um especialista em marketing digital e criação de conteúdo para redes sociais.
Sua missão é criar posts impactantes, alinhados à identidade da marca, com alta qualidade de copy e design textual.

CONTEXTO DA MARCA:
${brandContext}

${networkContext}

Tipo de post: ${postTypeLabel}

INSTRUÇÕES:
- Retorne EXCLUSIVAMENTE um JSON válido, sem markdown ou \`\`\`.
- Para posts estáticos ou stories, retorne:
  {
    "title": "título interno do post",
    "caption": "legenda completa com emojis",
    "hashtags": ["hashtag1", "hashtag2", ...],
    "cta": "chamada para ação",
    "slide": {
      "headline": "título principal do visual",
      "subtext": "subtexto ou descrição visual"
    }
  }
- Para carrosséis, retorne:
  {
    "title": "título interno",
    "caption": "legenda completa com emojis",
    "hashtags": ["hashtag1", ...],
    "cta": "chamada para ação",
    "slides": [
      { "order": 1, "headline": "...", "subtext": "..." },
      ...até 10 slides
    ]
  }
- A legenda deve ter no máximo 2.200 caracteres.
- Inclua hashtags relevantes e as hashtags padrão da marca.
- O CTA deve ser direto e persuasivo.
- Respeite o tom de voz e palavras proibidas da marca.`;

    // Ordered from most capable to most available — first successful one is used
    const MODEL_FALLBACKS = [
      "claude-sonnet-4-5-20250929",
      "claude-haiku-4-5-20251001",
      "claude-3-haiku-20240307",
    ] as const;

    let text: string | undefined;
    let lastAiError: any;

    for (const modelId of MODEL_FALLBACKS) {
      try {
        console.log(`[NASA Post] Tentando modelo: ${modelId}`);
        const result = await generateText({
          model: anthropic(modelId),
          system: systemPrompt,
          prompt: input.userPrompt,
        });
        text = result.text;
        console.log(`[NASA Post] Sucesso com modelo: ${modelId}`);
        break;
      } catch (aiError: any) {
        lastAiError = aiError;
        const msg = String(aiError?.message ?? aiError ?? "");
        console.error(`[NASA Post] Falhou ${modelId}:`, msg);
        // Only retry on model-not-found errors; stop immediately for auth/quota
        if (msg.includes("401") || msg.includes("authentication") || msg.includes("api_key") || msg.includes("invalid_api_key")) {
          throw new ORPCError("BAD_REQUEST", { message: "Chave de API Anthropic inválida. Verifique em Configurações da Marca → aba IA." });
        }
        if (msg.includes("429") || msg.includes("rate_limit")) {
          throw new ORPCError("BAD_REQUEST", { message: "Limite de requisições da Anthropic atingido. Aguarde alguns minutos." });
        }
        if (msg.includes("insufficient_quota") || msg.includes("credit_balance") || msg.includes("billing")) {
          throw new ORPCError("BAD_REQUEST", { message: "Créditos Anthropic esgotados. Verifique sua conta em console.anthropic.com." });
        }
        // 404 = model not found → try next in fallback list
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) continue;
        // Any other error → stop
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: `Erro ao chamar a IA: ${msg || "tente novamente"}` });
      }
    }

    if (!text) {
      const lastMsg = String(lastAiError?.message ?? lastAiError ?? "");
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: `Nenhum modelo de IA disponível. Último erro: ${lastMsg}` });
    }

    // Parse AI response
    let parsed: any;
    try {
      const clean = text.replace(/```json\n?|```\n?/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "IA retornou resposta inválida. Tente novamente." });
    }

    // Build slides array
    const slidesData: Array<{
      order: number;
      imageKey: null;
      headline: string | null;
      subtext: string | null;
      overlayConfig: object;
    }> = [];

    if (post.type === NasaPostType.CAROUSEL && Array.isArray(parsed.slides)) {
      parsed.slides.forEach((s: any, i: number) => {
        slidesData.push({
          order: s.order ?? i + 1,
          imageKey: null,
          headline: s.headline ?? null,
          subtext: s.subtext ?? null,
          overlayConfig: {},
        });
      });
    } else if (parsed.slide) {
      slidesData.push({
        order: 1,
        imageKey: null,
        headline: parsed.slide.headline ?? null,
        subtext: parsed.slide.subtext ?? null,
        overlayConfig: {},
      });
    }

    // Update post
    await prisma.nasaPostSlide.deleteMany({ where: { postId: post.id } });

    const updatedPost = await prisma.nasaPost.update({
      where: { id: post.id },
      data: {
        title: parsed.title ?? post.title,
        caption: parsed.caption ?? post.caption,
        hashtags: parsed.hashtags ?? post.hashtags,
        cta: parsed.cta ?? post.cta,
        status: NasaPostStatus.PENDING_APPROVAL,
        starsSpent: { increment: STARS_PER_GENERATION },
        slides: {
          createMany: { data: slidesData },
        },
      },
      include: {
        slides: { orderBy: { order: "asc" } },
        createdBy: { select: { id: true, name: true, image: true } },
      },
    });

      return { post: updatedPost, starsSpent: STARS_PER_GENERATION, balanceAfter: debit.newBalance };
    } catch (err: any) {
      // Re-throw ORPC errors as-is so the client gets the real message
      if (err instanceof ORPCError) throw err;
      // Log and wrap any other unexpected errors
      console.error("[NASA Post] Erro inesperado no generate-post:", err?.message ?? err);
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: err?.message ? `Erro interno: ${err.message}` : "Erro interno. Tente novamente.",
      });
    }
  });
