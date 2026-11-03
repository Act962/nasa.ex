import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { takeRateLimit } from "@/lib/rate-limit";
import { OBJECTIVE_LABEL } from "@/features/trafego/lib/catalog-labels";
import { parseRelease, type TrafegoReleaseContent } from "@/features/trafego/lib/release";
import { buildTechnicalOnlyReview, type CreativeTechnicalInput } from "@/features/trafego/lib/creative-review";
import {
  CreativeReviewError,
  reviewCreative,
  type CreativeFrame,
} from "@/features/trafego/server/lib/creative-review";
import {
  fetchMetaCdnFrame,
  loadStoredImageFrame,
  resolveOrgInstagramPost,
} from "@/features/trafego/server/lib/creative-review-sources";
import { loadWizardAccountContext } from "@/features/trafego/server/lib/meta/account-context";
import { suggestAdCopy } from "@/features/trafego/server/lib/copy-suggestion";

/**
 * Análise do criativo pelo Astro (spec 0126, RF-9..RF-15). Pedido e criativo são
 * conferidos contra a org ANTES de chamar a Meta ou a IA (CA-11). O navegador manda
 * só quadros já reduzidos; o servidor nunca baixa URL vinda do cliente.
 */

const MAX_FRAME_BASE64_CHARS = 2_000_000;
const FRAME_DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

const technicalSchema = z.object({
  kind: z.enum(["IMAGE", "VIDEO"]),
  width: z.number().int().min(0).nullable(),
  height: z.number().int().min(0).nullable(),
  durationSeconds: z.number().min(0).nullable(),
  fileSize: z.number().int().min(0).nullable(),
});

const analyzeInputSchema = z.object({
  orderId: z.string().min(1).optional(),
  creativeId: z.string().min(1).optional(),
  /** Wizard: o pedido ainda não existe, o contexto vem da tela. */
  context: z
    .object({ businessName: z.string().max(120).optional(), businessNiche: z.string().max(120).optional() })
    .optional(),
  /** Passo a passo do /trafego (spec 0129): devolve também a orientação, com os números da conta da org. */
  withGuidance: z.boolean().optional(),
  source: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("frames"),
      frames: z.array(z.string().max(MAX_FRAME_BASE64_CHARS)).max(4),
      technical: technicalSchema,
    }),
    z.object({ type: z.literal("post"), link: z.string().url().max(500) }),
  ]),
});

function parseFrame(dataUrl: string): CreativeFrame {
  const match = dataUrl.match(FRAME_DATA_URL);
  if (!match) throw new ORPCError("BAD_REQUEST", { message: "Imagem inválida para análise." });
  return { mediaType: match[1] as CreativeFrame["mediaType"], base64: match[2] };
}

function releaseToText(release: TrafegoReleaseContent | null): string | null {
  if (!release) return null;
  return [
    release.about,
    release.products.length ? `Produtos: ${release.products.join(", ")}` : null,
    release.differentials.length ? `Diferenciais: ${release.differentials.join(", ")}` : null,
    release.audience ? `Público: ${release.audience}` : null,
    release.offers.length ? `Ofertas: ${release.offers.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export const analyzeTrafegoCreative = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(analyzeInputSchema)
  .handler(async ({ input, context }) => {
    const limit = takeRateLimit("trafego-creative-review", context.org.id, { max: 20, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: `Muitas análises seguidas. Tente de novo em ${Math.ceil(limit.retryAfterSeconds / 60)} min.`,
      });
    }

    const order = input.orderId
      ? await prisma.trafegoOrder.findFirst({
          where: { id: input.orderId, organizationId: context.org.id },
          select: { id: true, platform: true, objective: true, businessName: true, businessNiche: true, release: true },
        })
      : null;
    if (input.orderId && !order) throw new ORPCError("NOT_FOUND", { message: "Campanha não encontrada." });

    const creative = input.creativeId
      ? await prisma.trafegoCreative.findFirst({
          where: { id: input.creativeId, order: { organizationId: context.org.id } },
          select: { id: true, orderId: true, kind: true, fileKey: true, mimeType: true, width: true, height: true, durationSeconds: true, fileSize: true },
        })
      : null;
    if (input.creativeId && (!creative || (order && creative.orderId !== order.id))) {
      throw new ORPCError("NOT_FOUND", { message: "Criativo não encontrado." });
    }

    let frames: CreativeFrame[] = [];
    let technical: CreativeTechnicalInput;
    const extraTexts: string[] = [];

    if (input.source.type === "post") {
      const resolved = await resolveOrgInstagramPost(context.org.id, input.source.link);
      if (!resolved.ok) throw new ORPCError("BAD_REQUEST", { message: resolved.message });
      const frame = await fetchMetaCdnFrame(resolved.post.previewUrl).catch(() => null);
      if (frame) frames = [frame];
      if (resolved.post.caption) extraTexts.push(resolved.post.caption);
      technical = {
        kind: resolved.post.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
        width: null,
        height: null,
        durationSeconds: null,
        fileSize: null,
      };
    } else {
      frames = input.source.frames.map(parseFrame);
      technical = creative
        ? {
            kind: creative.kind,
            width: creative.width,
            height: creative.height,
            durationSeconds: creative.durationSeconds,
            fileSize: creative.fileSize,
          }
        : input.source.technical;
      // Criativo antigo sem quadros vindos do navegador: lê a imagem guardada.
      if (frames.length === 0 && creative?.kind === "IMAGE") {
        const stored = await loadStoredImageFrame(creative.fileKey, creative.mimeType).catch(() => null);
        if (stored) frames = [stored];
      }
    }

    if (frames.length === 0) {
      // Vídeo que o navegador não decodificou (CB-6): só o técnico, sem IA e sem Stars.
      if (technical.kind !== "VIDEO") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Não conseguimos ver as imagens deste criativo. Envie o arquivo de novo para o Astro analisar.",
        });
      }
      const review = buildTechnicalOnlyReview(technical);
      if (creative) {
        await prisma.trafegoCreative.update({ where: { id: creative.id }, data: { astroReview: review as unknown as object } });
      }
      return { ...review, guidance: null };
    }

    try {
      const accountContext = input.withGuidance ? await loadWizardAccountContext(context.org.id) : null;
      const { review, guidance } = await reviewCreative({
        organizationId: context.org.id,
        userId: context.user.id,
        platform: order?.platform ?? "META_ADS",
        technical,
        frames,
        extraTexts,
        context: {
          businessName: order?.businessName ?? input.context?.businessName,
          businessNiche: order?.businessNiche ?? input.context?.businessNiche,
          objective: order ? OBJECTIVE_LABEL[order.objective] : null,
          release: releaseToText(parseRelease(order?.release)),
        },
        guidance: accountContext ? { accountText: accountContext.promptText } : undefined,
      });

      if (creative) {
        await prisma.trafegoCreative.update({
          where: { id: creative.id },
          data: { astroReview: review as unknown as object },
        });
      }
      return { ...review, guidance };
    } catch (error) {
      if (error instanceof CreativeReviewError) {
        throw new ORPCError(error.code === "INSUFFICIENT_STARS" ? "PRECONDITION_FAILED" : "SERVICE_UNAVAILABLE", {
          message: error.message,
        });
      }
      throw error;
    }
  });

/** Números da conta para os avisos do passo a passo (spec 0129, RF-3): só a integração da org de quem pede (CA-11). */
export const getTrafegoWizardAccountSummary = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const accountContext = await loadWizardAccountContext(context.org.id);
    return accountContext.summary;
  });

/**
 * Botão "Gere com IA" do passo Criativo (spec 0130, RF-1): texto, título e mensagem inicial.
 * O navegador manda os quadros que ainda tem; sem eles, o texto lido na análise.
 */
export const suggestTrafegoAdCopy = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      context: z
        .object({ businessName: z.string().max(120).optional(), businessNiche: z.string().max(120).optional() })
        .optional(),
      frames: z.array(z.string().max(MAX_FRAME_BASE64_CHARS)).max(4).optional(),
      creativeNotes: z.string().max(2000).optional(),
      postLink: z.string().url().max(500).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const limit = takeRateLimit("trafego-copy-suggestion", context.org.id, { max: 30, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: `Muitos pedidos seguidos. Tente de novo em ${Math.ceil(limit.retryAfterSeconds / 60)} min.`,
      });
    }

    let frames = (input.frames ?? []).map(parseFrame);
    const notes = input.creativeNotes ? [input.creativeNotes] : [];
    if (input.postLink && frames.length === 0) {
      const resolved = await resolveOrgInstagramPost(context.org.id, input.postLink);
      if (resolved.ok) {
        const frame = await fetchMetaCdnFrame(resolved.post.previewUrl).catch(() => null);
        if (frame) frames = [frame];
        if (resolved.post.caption) notes.push(`Legenda do post: ${resolved.post.caption}`);
      }
    }

    const accountContext = await loadWizardAccountContext(context.org.id);
    try {
      return await suggestAdCopy({
        organizationId: context.org.id,
        userId: context.user.id,
        platform: "META_ADS",
        frames,
        creativeNotes: notes.join("\n") || null,
        context: { businessName: input.context?.businessName, businessNiche: input.context?.businessNiche },
        accountText: accountContext.promptText,
      });
    } catch (error) {
      if (error instanceof CreativeReviewError) {
        throw new ORPCError(error.code === "INSUFFICIENT_STARS" ? "PRECONDITION_FAILED" : "SERVICE_UNAVAILABLE", {
          message: error.message,
        });
      }
      throw error;
    }
  });
