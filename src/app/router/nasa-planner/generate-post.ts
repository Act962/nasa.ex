import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { debitStars } from "@/lib/star-service";
import { logActivity } from "@/lib/activity-logger";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { NasaPlannerPostType, NasaPlannerPostStatus, StarTransactionType } from "@/generated/prisma/enums";
import {
  selectImageProvider, generateImage, generateTextViaPollinations, STARS_POST_FULL,
} from "./_helpers/ai-provider";

export const generatePost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      postId: z.string(),
      userPrompt: z.string().optional().default(""),
      networks: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const post = await prisma.nasaPlannerPost.findFirst({
        where: { id: input.postId, organizationId: context.org.id },
        include: { slides: true },
      });
      if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });

      const [planner, orgProject] = await Promise.all([
        prisma.nasaPlanner.findFirst({ where: { id: post.plannerId, organizationId: context.org.id } }),
        post.orgProjectId
          ? prisma.orgProject.findFirst({ where: { id: post.orgProjectId, organizationId: context.org.id } })
          : Promise.resolve(null),
      ]);

      const providerInfo = await selectImageProvider(context.org.id);

      let debit: { success: boolean; newBalance: number };
      try {
        debit = await debitStars(
          context.org.id, STARS_POST_FULL, StarTransactionType.APP_CHARGE,
          "NASA Planner — geração de conteúdo IA", "nasa-planner", context.user.id,
        );
      } catch (starErr: any) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: `Erro ao debitar stars: ${starErr?.message ?? "tente novamente"}` });
      }
      if (!debit.success) throw new ORPCError("BAD_REQUEST", { message: "Saldo de stars insuficiente para gerar o post" });

      const projSwot = orgProject?.swot as Record<string, string> | null;
      const projVisual = orgProject?.visual as Record<string, string> | null;
      const plannerSwot = planner?.swot as Record<string, string> | null;
      const plannerFonts = planner?.fonts as Record<string, string> | null;

      const brandName    = orgProject?.name           ?? planner?.brandName    ?? null;
      const brandSlogan  = orgProject?.slogan         ?? planner?.brandSlogan  ?? null;
      const brandIcp     = orgProject?.icp            ?? planner?.icp          ?? null;
      const brandPos     = orgProject?.positioning    ?? planner?.positioning   ?? null;
      const brandTone    = orgProject?.voiceTone      ?? planner?.toneOfVoice  ?? null;
      const brandSwotStr = projSwot?.strengths        ?? plannerSwot?.strengths ?? null;
      const brandFont    = projVisual?.heading        ?? plannerFonts?.heading  ?? null;
      const brandAiInstr = orgProject?.aiInstructions ?? null;

      const brandContext = [
        brandName    ? `Marca: ${brandName}`                                    : "",
        brandSlogan  ? `Slogan: ${brandSlogan}`                                 : "",
        brandIcp     ? `Público-alvo (ICP): ${brandIcp}`                        : "",
        brandPos     ? `Posicionamento: ${brandPos}`                            : "",
        brandTone    ? `Tom de voz: ${brandTone}`                               : "",
        planner?.keyMessages?.length    ? `Mensagens-chave: ${planner.keyMessages.join(", ")}`   : "",
        planner?.forbiddenWords?.length ? `Palavras proibidas: ${planner.forbiddenWords.join(", ")}` : "",
        planner?.primaryColors?.length  ? `Cores primárias: ${planner.primaryColors.join(", ")}`    : "",
        brandFont    ? `Tipografia principal: ${brandFont}`                     : "",
        planner?.defaultHashtags?.length ? `Hashtags padrão: ${planner.defaultHashtags.join(" ")}` : "",
        planner?.defaultCtas?.length     ? `CTAs padrão: ${planner.defaultCtas.join(" | ")}`       : "",
        brandSwotStr ? `Forças (SWOT): ${brandSwotStr}`                         : "",
        brandAiInstr ? `Instruções adicionais: ${brandAiInstr}`                 : "",
      ].filter(Boolean).join("\n") || "Nenhuma configuração de marca encontrada.";

      const postTypeLabel =
        post.type === NasaPlannerPostType.CAROUSEL ? "carrossel (múltiplos slides)"
        : post.type === NasaPlannerPostType.REEL ? "reel/vídeo"
        : post.type === NasaPlannerPostType.STORY ? "story"
        : "post estático";

      const networkContext =
        (input.networks ?? post.targetNetworks).length > 0
          ? `Redes sociais alvo: ${(input.networks ?? post.targetNetworks).join(", ")}`
          : "";

      const refLinksContext = post.referenceLinks?.length
        ? `\nLinks de referência (use como inspiração de estilo/formato):\n${post.referenceLinks.map((l, i) => `${i + 1}. ${l}`).join("\n")}`
        : "";

      const systemPrompt = `Você é um especialista em marketing digital e criação de conteúdo para redes sociais.
Sua missão é criar posts impactantes, alinhados à identidade da marca, com alta qualidade de copy e design textual.

CONTEXTO DA MARCA:
${brandContext}

${networkContext}${refLinksContext}

Tipo de post: ${postTypeLabel}

INSTRUÇÕES:
- Retorne EXCLUSIVAMENTE um JSON válido, sem markdown ou \`\`\`.
- Para posts estáticos ou stories, retorne:
  {"title":"título interno","caption":"legenda com emojis","hashtags":["#tag1"],"cta":"chamada para ação","slide":{"headline":"título visual","subtext":"subtexto"}}
- Para carrosséis, retorne:
  {"title":"título","caption":"legenda com emojis","hashtags":["#tag1"],"cta":"chamada","slides":[{"order":1,"headline":"...","subtext":"..."}]}
- A legenda deve ter no máximo 2.200 caracteres.
- Inclua hashtags relevantes e as hashtags padrão da marca.
- O CTA deve ser direto e persuasivo.
- Respeite o tom de voz e palavras proibidas da marca.
- RETORNE APENAS O JSON, sem explicações antes ou depois.`;

      const userPromptText = input.userPrompt
        || `Crie um ${postTypeLabel} envolvente e alinhado à identidade da marca. Use o contexto fornecido para produzir conteúdo de alta qualidade.`;

      const text = await generateTextViaPollinations(systemPrompt, userPromptText);
      if (!text) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Falha na geração de conteúdo. O serviço de IA não respondeu. Tente novamente.",
        });
      }

      let parsed: any;
      try {
        const clean = text.replace(/```json\n?|```\n?/g, "").trim();
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);
      } catch {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "IA retornou resposta inválida. Tente novamente." });
      }

      const imagePrompt = [
        parsed.title ?? "",
        parsed.slide?.headline ?? parsed.slides?.[0]?.headline ?? "",
        planner?.toneOfVoice ? `Style: ${planner.toneOfVoice}` : "",
        "Social media image, high quality, no text, impactful visual.",
      ].filter(Boolean).join(". ");

      const generatedImageKey = await generateImage(imagePrompt, providerInfo, "hd");

      const slidesData: Array<{ order: number; imageKey: string | null; headline: string | null; subtext: string | null; overlayConfig: object }> = [];

      if (post.type === NasaPlannerPostType.CAROUSEL && Array.isArray(parsed.slides)) {
        for (let i = 0; i < parsed.slides.length; i++) {
          const s = parsed.slides[i];
          let slideImageKey: string | null = i === 0 ? generatedImageKey : null;
          if (i > 0) {
            const slidePrompt = [s.headline ?? "", s.subtext ?? "", "Carousel slide, no text, high quality."].filter(Boolean).join(". ");
            slideImageKey = await generateImage(slidePrompt, providerInfo, "standard");
          }
          slidesData.push({ order: s.order ?? i + 1, imageKey: slideImageKey, headline: s.headline ?? null, subtext: s.subtext ?? null, overlayConfig: {} });
        }
      } else if (parsed.slide) {
        slidesData.push({ order: 1, imageKey: generatedImageKey, headline: parsed.slide.headline ?? null, subtext: parsed.slide.subtext ?? null, overlayConfig: {} });
      } else if (generatedImageKey) {
        slidesData.push({ order: 1, imageKey: generatedImageKey, headline: parsed.title ?? null, subtext: null, overlayConfig: {} });
      }

      await prisma.nasaPlannerPostSlide.deleteMany({ where: { postId: post.id } });

      const updatedPost = await prisma.nasaPlannerPost.update({
        where: { id: post.id },
        data: {
          title: parsed.title ?? post.title,
          caption: parsed.caption ?? post.caption,
          hashtags: parsed.hashtags ?? post.hashtags,
          cta: parsed.cta ?? post.cta,
          status: NasaPlannerPostStatus.PENDING_APPROVAL,
          starsSpent: { increment: STARS_POST_FULL },
          ...(generatedImageKey ? { thumbnail: generatedImageKey } : {}),
          slides: { createMany: { data: slidesData } },
        },
        include: {
          slides: { orderBy: { order: "asc" } },
          createdBy: { select: { id: true, name: true, image: true } },
        },
      });

      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "nasa-planner",
        subAppSlug: "planner-posts",
        featureKey: "planner.post.generated",
        action: "planner.post.generated",
        actionLabel: `Gerou conteúdo IA para um ${postTypeLabel}`,
        resource: parsed.title ?? null,
        resourceId: updatedPost.id,
        metadata: { type: post.type, starsSpent: STARS_POST_FULL, hasImage: !!generatedImageKey },
      });

      return { post: updatedPost, starsSpent: STARS_POST_FULL, balanceAfter: debit.newBalance };
    } catch (err: any) {
      if (err instanceof ORPCError) throw err;
      console.error("[NASA Planner] Unexpected error:", err?.message ?? err);
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: err?.message ? `Erro interno: ${err.message}` : "Erro interno. Tente novamente.",
      });
    }
  });
