import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { debitStars } from "@/lib/star-service";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { NasaPlannerPostType, NasaPlannerPostStatus, StarTransactionType } from "@/generated/prisma/enums";
import { S3 } from "@/lib/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const STARS_PER_GENERATION = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function uploadToS3(buffer: Buffer, contentType = "image/jpeg"): Promise<string | null> {
  try {
    const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES;
    if (!bucket) { console.error("[IMG] S3 bucket not configured"); return null; }
    const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
    const key = `nasa-planner/posts/${uuidv4()}.${ext}`;
    await S3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
    console.log(`[IMG] S3 upload OK: ${key} (${buffer.length} bytes)`);
    return key;
  } catch (err: any) {
    console.error("[IMG] S3 upload error:", err?.message);
    return null;
  }
}

// ─── TEXT via Pollinations.ai (free, no API key, no tokens) ──────────────────

async function generateTextViaPollinations(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const MODELS = ["openai", "openai-large", "mistral", "mistral-large"];
  for (const model of MODELS) {
    try {
      console.log(`[AI] Pollinations text — model: ${model}`);
      const resp = await fetchWithTimeout(
        "https://text.pollinations.ai/openai",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            jsonMode: true,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        },
        60000,
      );

      if (!resp.ok) {
        console.error(`[AI] Pollinations ${model}: HTTP ${resp.status}`);
        continue;
      }

      const data = await resp.json().catch(() => null);
      const text: string | undefined =
        data?.choices?.[0]?.message?.content ?? // OpenAI-compatible format
        (typeof data === "string" ? data : undefined);

      if (text && text.trim()) {
        console.log(`[AI] Pollinations ${model} OK`);
        return text.trim();
      }
    } catch (err: any) {
      console.error(`[AI] Pollinations ${model} error:`, err?.message);
      continue;
    }
  }
  return null;
}

// ─── IMAGE via Pollinations.ai (free, no API key, no tokens) ─────────────────

async function generateImage(prompt: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(prompt.slice(0, 400));
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&model=flux&nologo=true&seed=${Date.now()}`;
    console.log("[IMG] Generating via Pollinations.ai...");

    const resp = await fetchWithTimeout(url, {}, 50000);
    if (!resp.ok) { console.error(`[IMG] Pollinations HTTP ${resp.status}`); return null; }

    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 500) { console.error(`[IMG] Pollinations tiny: ${buffer.length} bytes`); return null; }

    const ct = resp.headers.get("content-type") ?? "image/jpeg";
    return await uploadToS3(buffer, ct.startsWith("image/") ? ct : "image/jpeg");
  } catch (err: any) {
    console.error("[IMG] Pollinations error:", err?.message);
    return null;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

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

      // Keep brand ref for image style hint
      const brand = planner;

      // Debit stars
      let debit: { success: boolean; newBalance: number };
      try {
        debit = await debitStars(
          context.org.id, STARS_PER_GENERATION, StarTransactionType.APP_CHARGE,
          "NASA Planner — geração de conteúdo IA", "nasa-planner", context.user.id,
        );
      } catch (starErr: any) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: `Erro ao debitar stars: ${starErr?.message ?? "tente novamente"}` });
      }
      if (!debit.success) throw new ORPCError("BAD_REQUEST", { message: "Saldo de stars insuficiente para gerar o post" });

      // Build brand context — OrgProject fields take priority over NasaPlanner fields
      const projSwot = orgProject?.swot as Record<string, string> | null;
      const projVisual = orgProject?.visual as Record<string, string> | null;
      const plannerSwot = planner?.swot as Record<string, string> | null;
      const plannerFonts = planner?.fonts as Record<string, string> | null;

      // Resolved brand values: OrgProject first, NasaPlanner as fallback
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
        planner?.keyMessages?.length   ? `Mensagens-chave: ${planner.keyMessages.join(", ")}`   : "",
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

      // ── Generate text via Pollinations.ai (free, no tokens) ──────────────────
      const text = await generateTextViaPollinations(systemPrompt, userPromptText);

      if (!text) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Falha na geração de conteúdo. O serviço de IA gratuito (Pollinations) não respondeu. Tente novamente.",
        });
      }

      // Parse AI response
      let parsed: any;
      try {
        const clean = text.replace(/```json\n?|```\n?/g, "").trim();
        // Extract JSON if surrounded by extra text
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);
      } catch {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "IA retornou resposta inválida. Tente novamente." });
      }

      // ── Generate image via Pollinations.ai (free, no tokens) ─────────────────
      const imagePrompt = [
        parsed.title ?? "",
        parsed.slide?.headline ?? parsed.slides?.[0]?.headline ?? "",
        brand?.toneOfVoice ? `Style: ${brand.toneOfVoice}` : "",
        "Social media image, high quality, no text, impactful visual.",
      ].filter(Boolean).join(". ");

      const generatedImageKey = await generateImage(imagePrompt);
      console.log("[IMG] Result:", generatedImageKey ?? "none — continuing without image");

      // Build slides
      const slidesData: Array<{ order: number; imageKey: string | null; headline: string | null; subtext: string | null; overlayConfig: object }> = [];

      if (post.type === NasaPlannerPostType.CAROUSEL && Array.isArray(parsed.slides)) {
        for (let i = 0; i < parsed.slides.length; i++) {
          const s = parsed.slides[i];
          let slideImageKey: string | null = i === 0 ? generatedImageKey : null;
          if (i > 0) {
            const slidePrompt = [s.headline ?? "", s.subtext ?? "", "Carousel slide, no text, high quality."].filter(Boolean).join(". ");
            slideImageKey = await generateImage(slidePrompt);
          }
          slidesData.push({ order: s.order ?? i + 1, imageKey: slideImageKey, headline: s.headline ?? null, subtext: s.subtext ?? null, overlayConfig: {} });
        }
      } else if (parsed.slide) {
        slidesData.push({ order: 1, imageKey: generatedImageKey, headline: parsed.slide.headline ?? null, subtext: parsed.slide.subtext ?? null, overlayConfig: {} });
      } else if (generatedImageKey) {
        slidesData.push({ order: 1, imageKey: generatedImageKey, headline: parsed.title ?? null, subtext: null, overlayConfig: {} });
      }

      // Persist
      await prisma.nasaPlannerPostSlide.deleteMany({ where: { postId: post.id } });

      const updatedPost = await prisma.nasaPlannerPost.update({
        where: { id: post.id },
        data: {
          title: parsed.title ?? post.title,
          caption: parsed.caption ?? post.caption,
          hashtags: parsed.hashtags ?? post.hashtags,
          cta: parsed.cta ?? post.cta,
          status: NasaPlannerPostStatus.PENDING_APPROVAL,
          starsSpent: { increment: STARS_PER_GENERATION },
          ...(generatedImageKey ? { thumbnail: generatedImageKey } : {}),
          slides: { createMany: { data: slidesData } },
        },
        include: {
          slides: { orderBy: { order: "asc" } },
          createdBy: { select: { id: true, name: true, image: true } },
        },
      });

      return { post: updatedPost, starsSpent: STARS_PER_GENERATION, balanceAfter: debit.newBalance };
    } catch (err: any) {
      if (err instanceof ORPCError) throw err;
      console.error("[NASA Planner] Unexpected error:", err?.message ?? err);
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: err?.message ? `Erro interno: ${err.message}` : "Erro interno. Tente novamente.",
      });
    }
  });
